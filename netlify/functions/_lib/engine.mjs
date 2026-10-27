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
const KEEP_MS = 90 * DAY_MS;

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
function cacheKey(city, trade) {
  return `cache:${normalize(city)}::${trade}`;
}

async function count(store, key) {
  const row = await store.get(key);
  return row && typeof row.n === 'number' ? row.n : 0;
}

async function bump(store, key) {
  const n = (await count(store, key)) + 1;
  await store.set(key, { n });
  return n;
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
  if ((await count(store, hour)) >= 3 || (await count(store, day)) >= 10) {
    return { ok: false, kind: 'rate' };
  }

  const entry = questionsFor(bank, input.trade);
  if (!entry) return { ok: false, kind: 'invalid', fields: { trade: 'Choose a trade from the list.' } };

  const cached = await store.get(cacheKey(input.city, input.trade));
  const ttl = num(env.CHECK_CACHE_TTL_HOURS, 24) * 3600000;
  const cacheFresh = cached && now.getTime() - Date.parse(cached.storedAt) < ttl;

  if (!cacheFresh && (await count(store, capKey(now))) >= num(env.CHECK_DAILY_CAP, 100)) {
    await bump(store, hour);
    await bump(store, day);
    return { ok: false, kind: 'rate' };
  }

  await bump(store, hour);
  await bump(store, day);

  const id = randomId(16);
  const job = {
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
  await store.set(`job:${id}`, job);
  const index = (await store.get('index')) || [];
  index.push({ id, expiresAt: job.expiresAt });
  await store.set('index', index);
  await prune(store, now);

  if (cacheFresh) {
    await finishJob({ store, job, answers: cached.answers, fromCache: cached, now, bank });
    return { ok: true, checkId: id, status: 'complete', cached: true };
  }

  await bump(store, capKey(now));
  return { ok: true, checkId: id, status: 'running', cached: false };
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
  for (const assistant of ASSISTANTS) await store.set(`prog:${checkId}:${assistant}`, 'asking');

  const groups = await Promise.all(
    ASSISTANTS.map(async (assistant) => {
      const rows = await Promise.all(
        rendered.map(async (question) => {
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
  const anyOk = ASSISTANTS.some((assistant) => answers.filter((row) => row.assistant === assistant).every((row) => !row.error) && answers.some((row) => row.assistant === assistant));
  if (anyOk) {
    await store.set(cacheKey(job.city, job.trade), {
      storedAt: now.toISOString(),
      city: job.city,
      trade: job.trade,
      answers,
    });
  }
  await finishJob({ store, job, answers, fromCache: null, now, bank });
  return { failures, summary: runSummary(answers, Date.now() - startedAt) };
}

async function finishJob({ store, job, answers, fromCache, now, bank }) {
  const entry = questionsFor(bank, job.trade);
  const scored = scoreAnswers({
    business: job.business,
    website: job.website,
    questionCount: (entry?.templates || []).length || 8,
    answers,
  });
  const failedAll = scored.assistantsOk === 0;
  const collectedAt = fromCache?.storedAt || now.toISOString();
  const next = {
    ...job,
    status: failedAll ? 'failed' : 'complete',
    cached: Boolean(fromCache),
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
          cached: Boolean(fromCache),
          cacheAgeHours: fromCache ? Math.max(0, (now.getTime() - Date.parse(fromCache.storedAt)) / 3600000) : 0,
        },
  };
  await store.set(`job:${job.id}`, next);
  if (fromCache) {
    for (const assistant of ASSISTANTS) {
      const rows = answers.filter((row) => row.assistant === assistant);
      const failed = rows.length === 0 || rows.some((row) => row.error);
      await store.set(`prog:${job.id}:${assistant}`, failed ? 'error' : 'done');
    }
  }
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
  for (const assistant of ASSISTANTS) {
    progress[assistant] = (await store.get(`prog:${checkId}:${assistant}`)) || (job.status === 'running' ? 'asking' : 'done');
  }
  return {
    ok: true,
    status: job.status,
    progress,
    result: job.result
      ? {
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
        }
      : null,
  };
}

async function prune(store, now) {
  const index = (await store.get('index')) || [];
  const keep = [];
  for (const item of index) {
    if (!item?.expiresAt || Date.parse(item.expiresAt) < now.getTime()) {
      if (item?.id) await store.del(`job:${item.id}`);
    } else {
      keep.push(item);
    }
  }
  if (keep.length !== index.length) await store.set('index', keep);
}
