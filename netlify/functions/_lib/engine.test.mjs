import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { acceptCheck, executeJob, readStatus, createMemoryStore, hashIp, DEFAULT_CALL_TIMEOUT_MS } from './engine.mjs';
import { TEMPLATES } from '../../../src/lib/ai-visibility/questions.mjs';

const bank = [
  { trade: 'Plumbing', pro: 'plumber', tradeNoun: 'plumbing', job: 'a water heater replacement', templates: TEMPLATES },
];
const env = { CHECK_IP_SALT: 'salt', CHECK_CACHE_TTL_HOURS: '24', CHECK_DAILY_CAP: '100', CHECK_CALL_TIMEOUT_MS: '1000' };
const input = { business: 'Harbor Plumbing Co.', city: 'Mesa, AZ', trade: 'Plumbing', website: '' };

function answerFor(call) {
  const named = call.questionIndex === 0 && call.assistant !== 'claude';
  return {
    text: named ? 'Harbor Plumbing is the one to call.' : 'A different company was mentioned.',
    citations: [],
    model: 'test',
    error: call.assistant === 'claude' ? 'timeout' : null,
  };
}

describe('check engine', () => {
  it('rate limits the fourth check from one IP within an hour', async () => {
    const store = createMemoryStore();
    const now = new Date('2026-10-27T12:00:00Z');
    for (let i = 0; i < 3; i++) {
      const res = await acceptCheck({ store, env, input, ip: '203.0.113.5', now, bank });
      assert.equal(res.ok, true);
    }
    const blocked = await acceptCheck({ store, env, input, ip: '203.0.113.5', now, bank });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.kind, 'rate');
  });

  it('does not store the raw IP', async () => {
    const store = createMemoryStore();
    await acceptCheck({ store, env, input, ip: '203.0.113.9', now: new Date(), bank });
    const dumped = JSON.stringify(store.snapshot());
    assert.equal(dumped.includes('203.0.113.9'), false);
    assert.equal(hashIp('203.0.113.9', 'salt'), hashIp('203.0.113.9', 'salt'));
    assert.notEqual(hashIp('203.0.113.9', 'salt'), hashIp('203.0.113.10', 'salt'));
  });

  it('scores a failed assistant as not available and re-asks only that assistant', async () => {
    const store = createMemoryStore();
    const now = new Date('2026-10-27T15:00:00Z');
    let calls = 0;
    const asked = [];
    const ask = async (call) => {
      calls += 1;
      asked.push(call.assistant);
      return answerFor(call);
    };
    const started = await acceptCheck({ store, env, input, ip: '198.51.100.8', now, bank });
    await executeJob({ store, env, checkId: started.checkId, ask, now, bank });
    const status = await readStatus(store, started.checkId, now);
    assert.equal(status.status, 'complete');
    assert.equal(status.result.cached, false);
    assert.equal(status.result.byAssistant.claude.named, null);
    assert.equal(status.result.byAssistant.claude.status, 'error');
    assert.equal(status.result.namedCount, 1);
    assert.equal(calls, 24);
    const cachedRows = Object.entries(store.snapshot())
      .filter(([key]) => key.startsWith('cache:v2:'))
      .flatMap(([, value]) => value.answers);
    assert.equal(cachedRows.length, 16);
    assert.equal(cachedRows.some((row) => row.error || row.assistant === 'claude'), false);

    const second = await acceptCheck({
      store,
      env,
      input: { ...input, business: 'Other Plumbing' },
      ip: '198.51.100.20',
      now,
      bank,
    });
    assert.equal(second.cached, false);
    assert.equal(second.status, 'running');
    await executeJob({ store, env, checkId: second.checkId, ask, now, bank });
    assert.equal(calls, 32);
    assert.equal(asked.slice(24).every((name) => name === 'claude'), true);
    const again = await readStatus(store, second.checkId, now);
    assert.equal(again.result.cached, false);
    assert.equal(JSON.stringify(again).includes('Harbor Plumbing is'), false);
  });

  it('reuses a city and trade only when every provider answered', async () => {
    const store = createMemoryStore();
    const now = new Date('2026-10-27T17:00:00Z');
    let calls = 0;
    const ask = async () => {
      calls += 1;
      return { text: 'Harbor Plumbing is the one to call.', citations: [], model: 'test', error: null };
    };
    const started = await acceptCheck({ store, env, input, ip: '198.51.100.11', now, bank });
    await executeJob({ store, env, checkId: started.checkId, ask, now, bank });
    assert.equal(calls, 24);
    const second = await acceptCheck({
      store,
      env,
      input: { ...input, business: 'Other Plumbing' },
      ip: '198.51.100.12',
      now,
      bank,
    });
    assert.equal(second.status, 'complete');
    assert.equal(second.cached, true);
    assert.equal(calls, 24);
    const again = await readStatus(store, second.checkId, now);
    assert.equal(again.result.cached, true);
    assert.deepEqual(again.result.failedAssistants, []);
  });

  it('drops a cache entry that contains a failure and asks again', async () => {
    const store = createMemoryStore();
    const now = new Date('2026-10-27T18:00:00Z');
    const tiny = [{
      trade: 'Plumbing',
      pro: 'plumber',
      tradeNoun: 'plumbing',
      job: 'a leak',
      templates: ['Who fixes drains in {city}?'],
    }];
    const row = {
      assistant: 'chatgpt',
      questionIndex: 0,
      question: 'Who fixes drains in Mesa, AZ?',
      text: 'Harbor Plumbing is the one to call.',
      citations: [],
      model: 'test',
      timestamp: now.toISOString(),
      latencyMs: 1,
      error: null,
    };
    await store.set('cache:mesa az::Plumbing', {
      storedAt: now.toISOString(),
      answers: [{ ...row, text: 'stale failure', error: 'timeout' }],
    });
    await store.set('cache:v2:mesa az::Plumbing', {
      version: 2,
      storedAt: now.toISOString(),
      city: 'Mesa, AZ',
      trade: 'Plumbing',
      answers: [row, { ...row, assistant: 'perplexity', text: '', error: 'error' }],
    });
    const seen = [];
    const started = await acceptCheck({ store, env, input, ip: '198.51.100.40', now, bank: tiny });
    assert.equal(started.cached, false);
    assert.equal(store.snapshot()['cache:mesa az::Plumbing'], undefined);
    await executeJob({
      store,
      env,
      checkId: started.checkId,
      now,
      bank: tiny,
      ask: async (call) => {
        seen.push(`${call.assistant}:${call.questionIndex}`);
        return { text: 'Fresh.', citations: [], model: 'test', error: null };
      },
    });
    assert.equal(seen.includes('chatgpt:0'), false);
    assert.deepEqual(seen.sort(), ['claude:0', 'perplexity:0']);
    const status = await readStatus(store, started.checkId, now);
    assert.equal(status.result.cached, false);
    const saved = store.snapshot()['cache:v2:mesa az::Plumbing'].answers;
    assert.equal(saved.length, 3);
    assert.equal(saved.every((item) => !item.error), true);
    assert.equal(saved.some((item) => item.text === 'stale failure'), false);
  });

  it('returns redacted provider failures and a per-provider summary', async () => {
    const fakeKey = ['sk', 'test', 'fake'].join('-') + 'x'.repeat(24);
    const store = createMemoryStore();
    const now = new Date('2026-10-27T16:00:00Z');
    const tiny = [{
      trade: 'Plumbing',
      pro: 'plumber',
      tradeNoun: 'plumbing',
      job: 'a leak',
      templates: ['Who fixes drains in {city}? Email pat@shop.test'],
    }];
    const started = await acceptCheck({ store, env, input, ip: '198.51.100.30', now, bank: tiny });
    const report = await executeJob({
      store,
      env,
      checkId: started.checkId,
      now,
      bank: tiny,
      ask: async (call) => {
        if (call.assistant === 'claude') return { text: 'Claude answered.', citations: [], model: 'claude-test', error: null };
        const err = new Error('http 400');
        err.status = 400;
        err.provider = call.assistant;
        err.model = call.assistant === 'chatgpt' ? 'gpt-6.1-sol' : 'sonar';
        err.body = { error: { type: 'invalid_request_error', message: `bad ${call.question} ${fakeKey}` } };
        throw err;
      },
    });
    const dumped = JSON.stringify(report.failures);
    assert.equal(dumped.includes('pat@shop.test'), false);
    assert.equal(dumped.includes(fakeKey), false);
    assert.equal(dumped.includes('Who fixes drains'), false);
    assert.equal(report.summary.providers.claude.answered, 1);
    assert.equal(report.summary.providers.claude.failed, 0);
    assert.equal(report.summary.providers.chatgpt.failed, 1);
    assert.equal(report.summary.providers.perplexity.answered, 0);
    assert.equal(report.failures.find((row) => row.provider === 'chatgpt').status, 400);
    assert.equal(DEFAULT_CALL_TIMEOUT_MS >= 90000, true);
  });
});
