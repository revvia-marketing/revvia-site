/** Stripe attribution helpers. Safe to import from the browser bundle. */

const SAFE = /[^A-Za-z0-9_-]/g;

export function sanitizeToken(value, max) {
  const cleaned = String(value || '').replace(SAFE, '').slice(0, max);
  return cleaned;
}

export function randomId(length) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * v-{visitId} or c-{checkId}, then _s-{source}_c-{campaign}.
 * Stripe drops invalid values; we still only emit the safe charset.
 */
export function clientReferenceId({ visitId, checkId, utmSource, utmCampaign }) {
  const head = checkId
    ? `c-${sanitizeToken(checkId, 40)}`
    : `v-${sanitizeToken(visitId, 40)}`;
  const tail = `_s-${sanitizeToken(utmSource, 40)}_c-${sanitizeToken(utmCampaign, 40)}`;
  return sanitizeToken(head + tail, 200);
}

export function appendCheckoutParams(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export function checkoutParams({ utm, visitId, checkId, email }) {
  const params = {};
  for (const key of UTM_KEYS) {
    const clean = sanitizeToken(utm?.[key], 150);
    if (clean) params[key] = clean;
  }
  params.client_reference_id = clientReferenceId({
    visitId,
    checkId,
    utmSource: utm?.utm_source,
    utmCampaign: utm?.utm_campaign,
  });
  if (email) params.prefilled_email = String(email).slice(0, 200);
  return params;
}

export function messageMatchVisible(utm) {
  const campaign = String(utm?.utm_campaign || '');
  const source = String(utm?.utm_source || '');
  return campaign.startsWith('cold-') || source === 'found-outbound';
}
