import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripeSignature, SIGNATURE_TOLERANCE_SEC } from './stripe-sign.mjs';

function header(payload, secret, timestamp) {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

describe('stripe signature', () => {
  const secret = ['unit', 'webhook', 'secret'].join('-');
  const payload = JSON.stringify({ id: 'evt_123', type: 'checkout.session.completed' });
  const now = 1_700_000_000;

  it('accepts a fresh signature over the raw body', () => {
    const result = verifyStripeSignature(payload, header(payload, secret, now), secret, now);
    assert.equal(result.ok, true);
  });

  it('rejects a tampered body, a stale timestamp, and a missing secret', () => {
    assert.equal(verifyStripeSignature(`${payload} `, header(payload, secret, now), secret, now).ok, false);
    assert.equal(verifyStripeSignature(payload, header(payload, secret, now - SIGNATURE_TOLERANCE_SEC - 5), secret, now).ok, false);
    assert.equal(verifyStripeSignature(payload, header(payload, secret, now), '', now).ok, false);
  });
});
