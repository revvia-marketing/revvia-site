/**
 * Instant-check job engine. Pure aside from the store and the `ask` function,
 * so the rate limits, cache, and scoring can be tested without API keys.
 */
import { createHash } from 'node:crypto';
import { scoreAnswers, ASSISTANTS } from '../../../src/lib/ai-visibility/score.mjs';
import { normalize } from '../../../src/lib/ai-visibility/match.mjs';
import { renderSet } from '../../../src/lib/ai-visibility/questions.mjs';
import { randomId } from '../../../src/lib/ai-visibility/ids.mjs';
import { safeProviderFailure } from './provider-log.mjs';

/** One web-search call. 24 run in parallel, so this is the wall-clock budget, under the 15-minute background limit. */
export const DEFAULT_CALL_TIMEOUT_MS = 90000;

const DAY_MS = 86400000;
/** Job records (business name + scored result) are deleted after this. */
export const KEEP_MS = 90 * DAY_MS;
/**
 * Expired index rows deleted per check-start. A full sweep used to run on the
 * request that returns a cached result, one blob delete at a time, so a
 * backlog held the first byte for minutes.
 */
export const PRUNE_LIMIT = 8;

export function hashIp(ip, salt) {
  return createHash('sha256').update(`${salt}\n${String(ip || '')}`).digest('hex');
}

export function createMemoryStore() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? structuredClone(map.get(key)) : null;
    },
    async set(key, value) {
      map.set(key, structuredClone(value));
    },
    async del(key) {
      map.delete(key);
    },
    snapshot() {
      return structuredClone(Object.fromEntries(map));
    },
  };
}

function hourKey(hash, now) {
  return `rl:h:${hash}:${now.toISOString().slice(0, 13)}`;
}
function dayKey(hash, now) {
  return `rl:d:${hash}:${now.toISOString().slice(0, 10)}`;
}
function capKey(now) {
  return `cap:${now.toISOString().slice(0, 10)}`;
}
const CACHE_VERSION = 'v2';

function cacheKey(city, trade) {
  return `cache:${CACHE_VERSION}:${normalize(city)}::${trade}`;
}

function legacyCacheKey(city, trade) {
  return `cache:${normalize(city)}::${trade}`;
}

function answerSucceeded(row) {
  return Boolean(row) && !row.error && row.assistant && Number.isInteger(row.questionIndex);
}

function cellKey(assistant, questionIndex) {
  return `${assistant}:${questionIndex}`;
}

function freshSuccesses(cached, now, ttl) {
  const rows = Array.isArray(cached?.answers) ? cached.answers : [];
  const out = [];
  for (const row of rows) {
    if (!answerSucceeded(row)) continue;
    const at = Date.parse(row.timestamp || '');
    if (!Number.isFinite(at) || now.getTime() - at >= ttl) continue;
    out.push(row);
  }
  return out;
}

function covers(answers, rendered) {
  if (!rendered.length) return false;
  const have = new Set(answers.map((row) => cellKey(row.assistant, row.questionIndex)));
  return ASSISTANTS.every((assistant) => rendered.every((question) => have.has(cellKey(assistant, question.index))));
}

function oldestIso(answers, fallback) {
  let oldest = null;
  for (const row of answers || []) {
    const at = Date.parse(row?.timestamp || '');
    if (!Number.isFinite(at)) continue;
    if (oldest == null || at < oldest) oldest = at;
  }
  return oldest == null ? fallback : new Date(oldest).toISOString();
}

async function readReusable(store, city, trade, now, ttl) {
  await store.del(legacyCacheKey(city, trade));
  const key = cacheKey(city, trade);
  const cached = await store.get(key);
  const reusable = freshSuccesses(cached, now, ttl);
  const stored = Array.isArray(cached?.answers) ? cached.answers : [];
  const dirty = stored.length !== reusable.length || stored.some((row) => row?.error);
  if (cached && dirty) {
    if (reusable.length) {
      await store.set(key, {
        version: 2,
        storedAt: cached.storedAt || now.toISOString(),
        city,
        trade,
        answers: reusable,
      });
    } else {
      await store.del(key);
    }
  }
  return reusable;
}

async function saveSuccesses(store, city, trade, previous, latest, now, ttl) {
  const map = new Map();
  for (const row of freshSuccesses({ answers: previous }, now, ttl)) {
    map.set(cellKey(row.assistant, row.questionIndex), row);
  }
  for (const row of latest || []) {
    if (!answerSucceeded(row)) continue;
    map.set(cellKey(row.assistant, row.questionIndex), row);
  }
  const answers = [...map.values()];
  const key = cacheKey(city, trade);
  if (!answers.length) {
    await store.del(key);
    return;
  }
  await store.set(key, {
    version: 2,
    storedAt: now.toISOString(),
    city,
    trade,
    answers,
  });
}

async function count(store, key) {
  const row = await store.get(key);
  return row && typeof row.n === 'number' ? row.n : 0;
}

/**
 * Split an index into rows to keep, rows to delete now, and rows to leave
 * for a later request. `limit` caps how many deletes one request will do.
 */
export function planPrune(index, now, limit = PRUNE_LIMIT) {
  const list = Array.isArray(index) ? index : [];
  const keep = [];
  const drop = [];
  const cutoff = now.getTime();
  for (const item of list) {
    const at = Date.parse(item?.expiresAt || '');
    if (!item?.expiresAt || !Number.isFinite(at) || at < cutoff) drop.push(item);
    else keep.push(item);
  }
  const batch = drop.slice(0, Math.max(0, limit));
  const deferred = drop.slice(Math.max(0, limit));
  return {
    next: keep.concat(deferred),
    deleteIds: batch.map((item) => item?.id).filter(Boolean),
  };
}

export function questionsFor(bank, trade) {
  return (bank || []).find((entry) => entry.trade === trade) || null;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function acceptCheck({ store, env, input, ip, now = new Date(), bank }) {
  const hash = hashIp(ip || 'anonymous', env.CHECK_IP_SALT);
  const hour = hourKey(hash, now);
  const day = dayKey(hash, now);
  // One wave for the two counters. A cache hit used to re-read each of them
  // inside a later increment, then write a running job, rewrite the whole
  // index, prune every expired row, and write per-assistant progress before
  // the response. Strong-consistency blob calls are sequential round trips.
  const [hourN, dayN] = await Promise.all([count(store, hour), count(store, day)]);
  if (hourN >= 3 || dayN >= 10) return { ok: false, kind: 'rate' };

  const entry = questionsFor(bank, input.trade);
  if (!entry) return { ok: false, kind: 'invalid', fields: { trade: 'Choose a trade from the list.' } };

  const ttl = num(env.CHECK_CACHE_TTL_HOURS, 24) * 3600000;
  const rendered = renderSet(entry, input.city);
  const [reusable, storedIndex] = await Promise.all([
    readReusable(store, input.city, input.trade, now, ttl),
    store.get('index'),
  ]);
  const fullHit = covers(reusable, rendered);
  const cap = capKey(now);
  let capN = 0;
  if (!fullHit) {
    capN = await count(store, cap);
    if (capN >= num(env.CHECK_DAILY_CAP, 100)) {
      await Promise.all([
        store.set(hour, { n: hourN + 1 }),
        store.set(day, { n: dayN + 1 }),
      ]);
      return { ok: false, kind: 'rate' };
    }
  }

  const id = randomId(16);
  let job = {
    id,
    business: input.business,
    city: input.city,
    trade: input.trade,
    website: input.website || '',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + KEEP_MS).toISOString(),
    status: 'running',
    cached: false,
  };
  if (fullHit) {
    job = settleJob({
      job,
      answers: reusable,
      fromCache: { storedAt: oldestIso(reusable, now.toISOString()) },
      now,
      bank,
    });
  }

  const index = Array.isArray(storedIndex) ? storedIndex.slice() : [];
  index.push({ id, expiresAt: job.expiresAt });
  const pruned = planPrune(index, now, PRUNE_LIMIT);
  const writes = [
    store.set(hour, { n: hourN + 1 }),
    store.set(day, { n: dayN + 1 }),
    store.set(`job:${id}`, job),
    store.set('index', pruned.next),
    ...pruned.deleteIds.map((jobId) => store.del(`job:${jobId}`)),
  ];
  if (!fullHit) writes.push(store.set(cap, { n: capN + 1 }));
  await Promise.all(writes);

  return {
    ok: true,
    checkId: id,
    status: job.status,
    cached: Boolean(job.cached),
    result: publicResult(job),
  };
}

export function runSummary(answers, durationMs) {
  const providers = {};
  for (const id of ASSISTANTS) {
    const rows = (answers || []).filter((row) => row.assistant === id);
    const failed = rows.filter((row) => row.error).length;
    providers[id] = { answered: rows.length - failed, failed };
  }
  return { durationMs, providers };
}

export async function executeJob({ store, env, checkId, ask, now = new Date(), bank }) {
  const startedAt = Date.now();
  const failures = [];
  const job = await store.get(`job:${checkId}`);
  if (!job || job.status === 'complete' || job.status === 'failed') {
    return { failures, summary: runSummary([], Date.now() - startedAt) };
  }
  const entry = questionsFor(bank, job.trade);
  const rendered = renderSet(entry, job.city);
  const ttl = num(env.CHECK_CACHE_TTL_HOURS, 24) * 3600000;
  const reusable = await readReusable(store, job.city, job.trade, now, ttl);
  const reused = new Map(reusable.map((row) => [cellKey(row.assistant, row.questionIndex), row]));
  await Promise.all(ASSISTANTS.map((assistant) => {
    const pending = rendered.some((question) => !reused.has(cellKey(assistant, question.index)));
    return store.set(`prog:${checkId}:${assistant}`, pending ? 'asking' : 'done');
  }));

  let asked = 0;
  const groups = await Promise.all(
    ASSISTANTS.map(async (assistant) => {
      const rows = await Promise.all(
        rendered.map(async (question) => {
          const hit = reused.get(cellKey(assistant, question.index));
          if (hit) return hit;
          asked += 1;
          const started = Date.now();
          try {
            const result = await ask({
              assistant,
              question: question.text,
              questionIndex: question.index,
              city: job.city,
              timeoutMs: num(env.CHECK_CALL_TIMEOUT_MS, DEFAULT_CALL_TIMEOUT_MS),
            });
            if (result?.error) {
              failures.push(safeProviderFailure({
                provider: assistant,
                model: result.model || '',
                question: question.text,
                err: { name: result.error, message: result.error },
              }));
            }
            return {
              assistant,
              questionIndex: question.index,
              question: question.text,
              text: result.text || '',
              citations: result.citations || [],
              model: result.model || '',
              timestamp: new Date().toISOString(),
              latencyMs: Date.now() - started,
              error: result.error || null,
            };
          } catch (err) {
            const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
            failures.push(safeProviderFailure({
              provider: err?.provider || assistant,
              model: err?.model || '',
              question: question.text,
              err,
            }));
            return {
              assistant,
              questionIndex: question.index,
              question: question.text,
              text: '',
              citations: [],
              model: err?.model || '',
              timestamp: new Date().toISOString(),
              latencyMs: Date.now() - started,
              error: timedOut ? 'timeout' : 'error',
            };
          }
        })
      );
      const failed = rows.some((row) => row.error);
      await store.set(`prog:${checkId}:${assistant}`, failed ? 'error' : 'done');
      await store.set(`ans:${checkId}:${assistant}`, rows);
      return rows;
    })
  );
  const answers = groups.flat();
  await saveSuccesses(store, job.city, job.trade, reusable, answers, now, ttl);
  const everySuccess = answers.length > 0 && answers.every((row) => !row.error);
  const fromCache = asked === 0 && everySuccess
    ? { storedAt: oldestIso(answers, now.toISOString()) }
    : null;
  await finishJob({ store, job, answers, fromCache, now, bank });
  return { failures, summary: runSummary(answers, Date.now() - startedAt) };
}

function settleJob({ job, answers, fromCache, now, bank }) {
  const entry = questionsFor(bank, job.trade);
  const scored = scoreAnswers({
    business: job.business,
    website: job.website,
    questionCount: (entry?.templates || []).length || 8,
    answers,
  });
  const failedAll = scored.assistantsOk === 0;
  const everySuccess = (answers || []).length > 0 && (answers || []).every((row) => !row.error);
  const reused = Boolean(fromCache) && everySuccess;
  const collectedAt = reused ? (fromCache.storedAt || now.toISOString()) : now.toISOString();
  return {
    ...job,
    status: failedAll ? 'failed' : 'complete',
    cached: reused,
    cacheStoredAt: fromCache?.storedAt || null,
    answers,
    result: failedAll
      ? null
      : {
          business: job.business,
          city: job.city,
          trade: job.trade,
          namedCount: scored.namedCount,
          possibleCount: scored.possibleCount,
          assistantsOk: scored.assistantsOk,
          failedAssistants: scored.failedAssistants,
          byAssistant: scored.byAssistant,
          collectedAt,
          cached: reused,
          cacheAgeHours: reused ? Math.max(0, (now.getTime() - Date.parse(fromCache.storedAt)) / 3600000) : 0,
        },
  };
}

function publicResult(job) {
  if (!job?.result) return null;
  return {
    business: job.result.business,
    city: job.result.city,
    trade: job.result.trade,
    namedCount: job.result.namedCount,
    possibleCount: job.result.possibleCount,
    assistantsOk: job.result.assistantsOk,
    failedAssistants: job.result.failedAssistants,
    byAssistant: job.result.byAssistant,
    collectedAt: job.result.collectedAt,
    cached: job.result.cached,
    cacheAgeHours: job.result.cacheAgeHours,
  };
}

async function finishJob({ store, job, answers, fromCache, now, bank }) {
  const next = settleJob({ job, answers, fromCache, now, bank });
  await store.set(`job:${job.id}`, next);
  if (next.cached) {
    await Promise.all(ASSISTANTS.map((assistant) => {
      const rows = answers.filter((row) => row.assistant === assistant);
      const failed = rows.length === 0 || rows.some((row) => row.error);
      return store.set(`prog:${job.id}:${assistant}`, failed ? 'error' : 'done');
    }));
  }
  return next;
}

export async function readStatus(store, checkId, now = new Date()) {
  if (!/^[a-z0-9]{8,32}$/.test(checkId || '')) return null;
  const job = await store.get(`job:${checkId}`);
  if (!job) return null;
  if (job.expiresAt && Date.parse(job.expiresAt) < now.getTime()) {
    await store.del(`job:${checkId}`);
    return null;
  }
  const progress = {};
  if (job.status === 'running') {
    const rows = await Promise.all(ASSISTANTS.map((assistant) => store.get(`prog:${checkId}:${assistant}`)));
    ASSISTANTS.forEach((assistant, i) => {
      progress[assistant] = rows[i] || 'asking';
    });
  } else {
    for (const assistant of ASSISTANTS) {
      const cell = job.result?.byAssistant?.[assistant];
      progress[assistant] = cell?.status === 'error' ? 'error' : 'done';
    }
  }
  return {
    ok: true,
    status: job.status,
    progress,
    result: publicResult(job),
  };
}
