import { createHmac, timingSafeEqual } from 'node:crypto';

/** Stripe's default tolerance. Reject older signatures so a captured body can't be replayed. */
export const SIGNATURE_TOLERANCE_SEC = 300;

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verify a Stripe-Signature header against the raw request body.
 * The webhook secret is the HMAC key as stored (the full env value).
 */
export function verifyStripeSignature(rawBody, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  const payload = String(rawBody ?? '');
  const sigHeader = String(header ?? '');
  const key = String(secret ?? '');
  if (!payload || !sigHeader || !key) return { ok: false };

  let timestamp = '';
  const v1 = [];
  for (const part of sigHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v || '';
    if (k === 'v1' && v) v1.push(v);
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || v1.length === 0) return { ok: false };
  if (Math.abs(nowSec - ts) > SIGNATURE_TOLERANCE_SEC) return { ok: false };

  const expected = createHmac('sha256', key).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  const match = v1.some((candidate) => safeEqual(candidate, expected));
  return match ? { ok: true } : { ok: false };
}
