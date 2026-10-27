import { createHmac, timingSafeEqual } from 'node:crypto';

/** Portal configuration from docs/billing-link.md. Not a secret. */
export const BILLING_PORTAL_CONFIGURATION = 'bpc_1UUy7pDi4PfrgafHEJeVLdrh';

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function customerIdOk(id) {
  return /^cus_[A-Za-z0-9]+$/.test(String(id || ''));
}

/** Signed token tied to a Stripe customer id. The secret never leaves the server. */
export function signBillingToken(customerId, secret) {
  const key = String(secret || '');
  if (!key || !customerIdOk(customerId)) return '';
  const body = Buffer.from(String(customerId), 'utf8').toString('base64url');
  const sig = createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function customerIdFromToken(token, secret) {
  const key = String(secret || '');
  const raw = String(token || '');
  if (!key || !raw) return '';
  const parts = raw.split('.');
  if (parts.length !== 2) return '';
  const [body, sig] = parts;
  if (!body || !sig) return '';
  const expected = createHmac('sha256', key).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return '';
  let id = '';
  try {
    id = Buffer.from(body, 'base64url').toString('utf8');
  } catch {
    return '';
  }
  return customerIdOk(id) ? id : '';
}
