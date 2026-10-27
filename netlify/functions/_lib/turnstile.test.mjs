import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTurnstileToken } from './turnstile.mjs';

const SECRET = 'secret-value';
const TOKEN = 'token-value';

describe('verifyTurnstileToken', () => {
  it('logs a missing token and does not call siteverify', async () => {
    const logs = [];
    let called = false;
    const ok = await verifyTurnstileToken('', '203.0.113.4', {
      secret: SECRET,
      fetchImpl: async () => {
        called = true;
        return { json: async () => ({ success: true }) };
      },
      log: (...args) => logs.push(args),
    });
    assert.equal(ok, false);
    assert.equal(called, false);
    assert.deepEqual(logs, [['[check] turnstile rejected', 'missing token']]);
    assert.equal(JSON.stringify(logs).includes(SECRET), false);
  });

  it('logs both reasons when the token and the secret are missing', async () => {
    const logs = [];
    const ok = await verifyTurnstileToken('  ', '', {
      secret: ' ',
      fetchImpl: async () => {
        throw new Error('siteverify should not be called');
      },
      log: (...args) => logs.push(args),
    });
    assert.equal(ok, false);
    assert.deepEqual(logs, [['[check] turnstile rejected', ['missing token', 'missing secret']]]);
  });

  it('logs a missing secret and does not call siteverify', async () => {
    const logs = [];
    let called = false;
    const ok = await verifyTurnstileToken(TOKEN, '203.0.113.4', {
      secret: '',
      fetchImpl: async () => {
        called = true;
        return { json: async () => ({ success: true }) };
      },
      log: (...args) => logs.push(args),
    });
    assert.equal(ok, false);
    assert.equal(called, false);
    assert.deepEqual(logs, [['[check] turnstile rejected', 'missing secret']]);
    assert.equal(JSON.stringify(logs).includes(TOKEN), false);
  });

  it('logs Cloudflare error-codes and never the secret or token', async () => {
    const logs = [];
    const ok = await verifyTurnstileToken(TOKEN, '203.0.113.4', {
      secret: SECRET,
      fetchImpl: async (_url, init) => {
        assert.equal(init.body.get('secret'), SECRET);
        assert.equal(init.body.get('response'), TOKEN);
        assert.equal(init.body.get('remoteip'), '203.0.113.4');
        return { json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) };
      },
      log: (...args) => logs.push(args),
    });
    assert.equal(ok, false);
    assert.deepEqual(logs, [['[check] turnstile rejected', ['invalid-input-response']]]);
    const printed = JSON.stringify(logs);
    assert.equal(printed.includes(SECRET), false);
    assert.equal(printed.includes(TOKEN), false);
  });

  it('accepts a successful siteverify response', async () => {
    const logs = [];
    const ok = await verifyTurnstileToken(TOKEN, '', {
      secret: SECRET,
      fetchImpl: async () => ({ json: async () => ({ success: true, 'error-codes': [] }) }),
      log: (...args) => logs.push(args),
    });
    assert.equal(ok, true);
    assert.deepEqual(logs, []);
  });
});
