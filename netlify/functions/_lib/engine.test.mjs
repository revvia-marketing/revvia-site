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

  it('scores a failed assistant as not available and caches the city and trade', async () => {
    const store = createMemoryStore();
    const now = new Date('2026-10-27T15:00:00Z');
    let calls = 0;
    const ask = async (call) => {
      calls += 1;
      return answerFor(call);
    };
    const started = await acceptCheck({ store, env, input, ip: '198.51.100.8', now, bank });
    await executeJob({ store, env, checkId: started.checkId, ask, now, bank });
    const status = await readStatus(store, started.checkId, now);
    assert.equal(status.status, 'complete');
    assert.equal(status.result.byAssistant.claude.named, null);
    assert.equal(status.result.byAssistant.claude.status, 'error');
    assert.equal(status.result.namedCount, 1);
    assert.equal(calls, 24);

    const second = await acceptCheck({
      store,
      env,
      input: { ...input, business: 'Other Plumbing' },
      ip: '198.51.100.20',
      now,
      bank,
    });
    assert.equal(second.cached, true);
    assert.equal(calls, 24);
    const again = await readStatus(store, second.checkId, now);
    assert.equal(again.result.cached, true);
    assert.equal(JSON.stringify(again).includes('Harbor Plumbing is'), false);
  });

  it('returns redacted provider failures and a per-provider summary', async () => {
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
        err.body = { error: { type: 'invalid_request_error', message: `bad ${call.question} sk-live-ABCDEFGHIJKLMNOP` } };
        throw err;
      },
    });
    const dumped = JSON.stringify(report.failures);
    assert.equal(dumped.includes('pat@shop.test'), false);
    assert.equal(dumped.includes('sk-live-ABCDEFGHIJKLMNOP'), false);
    assert.equal(dumped.includes('Who fixes drains'), false);
    assert.equal(report.summary.providers.claude.answered, 1);
    assert.equal(report.summary.providers.claude.failed, 0);
    assert.equal(report.summary.providers.chatgpt.failed, 1);
    assert.equal(report.summary.providers.perplexity.answered, 0);
    assert.equal(report.failures.find((row) => row.provider === 'chatgpt').status, 400);
    assert.equal(DEFAULT_CALL_TIMEOUT_MS >= 90000, true);
  });
});
