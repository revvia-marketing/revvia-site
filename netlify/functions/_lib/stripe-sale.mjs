/**
 * Checkout sessions for Revvia AI Visibility.
 * Live First Door payment links (Keep and Grow) set metadata.product_line
 * to revvia_ai_visibility. The link ids are a fallback when that metadata
 * is present on the link but not copied onto the session.
 */

export const PRODUCT_LINE = 'revvia_ai_visibility';

/** Verified live payment links. Keep, then Grow. */
export const AI_VISIBILITY_LINKS = {
  plink_1UUy77Di4PfrgafHmPyzn6oz: 'keep',
  plink_1UUy7GDi4PfrgafH9IdcXHWN: 'grow',
};

const PLANS = {
  keep: { code: 'keep', name: 'Keep', monthly: 297 },
  grow: { code: 'grow', name: 'Grow', monthly: 497 },
};

export function paymentLinkId(session) {
  const link = session?.payment_link;
  if (typeof link === 'string') return link;
  if (link && typeof link.id === 'string') return link.id;
  return '';
}

export function isAiVisibilitySession(session) {
  if (!session || typeof session !== 'object') return false;
  const metas = [session.metadata, session.subscription_details?.metadata];
  if (metas.some((meta) => meta && meta.product_line === PRODUCT_LINE)) return true;
  const link = paymentLinkId(session);
  return Boolean(link && AI_VISIBILITY_LINKS[link]);
}

export function stripeId(value, prefix) {
  const id = typeof value === 'string' ? value : value?.id;
  if (typeof id !== 'string') return '';
  return id.startsWith(prefix) ? id : '';
}

export function customFieldValue(session, key) {
  const fields = Array.isArray(session?.custom_fields) ? session.custom_fields : [];
  const field = fields.find((item) => item && item.key === key);
  if (!field) return '';
  if (field.text?.value) return String(field.text.value).trim();
  if (field.dropdown?.value) return String(field.dropdown.value).trim();
  if (field.numeric?.value != null && field.numeric.value !== '') return String(field.numeric.value).trim();
  return '';
}

export function formatDollars(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '0';
  const dollars = n / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}

export function formatAddress(address) {
  if (!address || typeof address !== 'object') return 'none';
  const city = [address.city, address.state].filter(Boolean).join(', ');
  const cityLine = [city, address.postal_code].filter(Boolean).join(' ');
  const lines = [address.line1, address.line2, cityLine, address.country].filter(Boolean);
  return lines.join(', ') || 'none';
}

export function planFromSession(session) {
  const code = String(session?.metadata?.plan || AI_VISIBILITY_LINKS[paymentLinkId(session)] || '').toLowerCase();
  if (PLANS[code]) return PLANS[code];
  const name = code ? code.charAt(0).toUpperCase() + code.slice(1) : 'AI Visibility';
  return { code, name, monthly: 0 };
}

export function promotionRefs(session) {
  const discounts = Array.isArray(session?.discounts) ? session.discounts : [];
  const codes = [];
  const ids = [];
  for (const discount of discounts) {
    const promo = discount?.promotion_code;
    if (!promo) continue;
    if (typeof promo === 'string') ids.push(promo);
    else if (promo.code) codes.push(String(promo.code));
    else if (promo.id) ids.push(String(promo.id));
  }
  return { codes, ids };
}

export function customerEmail(session) {
  return String(session?.customer_details?.email || session?.customer_email || '').trim();
}

export function customerName(session) {
  const details = session?.customer_details || {};
  return String(details.name || details.individual_name || details.business_name || '').trim();
}

/**
 * Handle one verified Stripe event. Idempotent on event id when `store` is set.
 * `lookupPromo` returns the human code or '' . Mail failures throw so Stripe retries.
 */
export async function processStripeEvent({ event, store, env, send, lookupPromo, emailsFor }) {
  if (event?.type !== 'checkout.session.completed') return { action: 'ignore' };
  const session = event?.data?.object;
  if (!isAiVisibilitySession(session)) return { action: 'ignore' };
  const eventId = String(event.id || '');
  if (!eventId) return { action: 'ignore' };

  const key = `stripe:${eventId}`;
  let state = store ? await store.get(key) : null;
  if (state?.status === 'sent') return { action: 'duplicate' };
  if (!state || !Array.isArray(state.sent)) state = { status: 'pending', sent: [] };

  const promo = String((await lookupPromo(session)) || '').trim();
  const emails = emailsFor(session, promo, env);
  for (const email of emails) {
    const stamp = `${email.to}|${email.subject}`;
    if (state.sent.includes(stamp)) continue;
    const result = await send(email);
    if (!result?.ok) {
      if (store) await store.set(key, state);
      const err = new Error('mail');
      err.code = 'mail';
      throw err;
    }
    state.sent.push(stamp);
    if (store) await store.set(key, state);
  }
  state.status = 'sent';
  if (store) await store.set(key, state);
  return { action: 'sent' };
}
