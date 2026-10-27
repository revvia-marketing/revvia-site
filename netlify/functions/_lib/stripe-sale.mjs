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

export function sessionLineItems(session) {
  const raw = session?.line_items;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

function cents(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isRecurringItem(item) {
  const price = item?.price;
  if (!price || typeof price !== 'object') return false;
  if (price.recurring) return true;
  return price.type === 'recurring';
}

function isSetupItem(item) {
  if (isRecurringItem(item)) return false;
  const desc = String(item?.description || item?.price?.nickname || '').toLowerCase();
  if (desc.includes('setup')) return true;
  return item?.price?.type === 'one_time';
}

function lineListCents(item) {
  const sub = cents(item?.amount_subtotal);
  if (sub != null) return sub;
  const unit = cents(item?.price?.unit_amount);
  const qty = Number(item?.quantity) || 1;
  if (unit != null) return unit * qty;
  return cents(item?.amount_total) ?? 0;
}

/**
 * What the buyer actually paid for setup, from line items when Stripe sent
 * them and otherwise from amount_total minus the plan's monthly price.
 */
export function describeCharges(session, plan = planFromSession(session)) {
  const sessionDiscount = cents(session?.total_details?.amount_discount) ?? 0;
  const items = sessionLineItems(session);
  const monthlyList = plan?.monthly ? plan.monthly * 100 : 0;
  if (items.length) {
    const setup = items.filter(isSetupItem);
    const recurring = items.filter(isRecurringItem);
    const monthlyCents = recurring.reduce((sum, item) => sum + (cents(item.amount_total) ?? 0), 0) || monthlyList;
    if (!setup.length) {
      return { known: false, waived: false, listCents: 0, dueCents: null, discountCents: sessionDiscount, monthlyCents };
    }
    const listCents = setup.reduce((sum, item) => sum + lineListCents(item), 0);
    const dueCents = setup.reduce((sum, item) => sum + (cents(item.amount_total) ?? lineListCents(item)), 0);
    const lineDiscount = setup.reduce((sum, item) => sum + (cents(item.amount_discount) ?? 0), 0);
    return {
      known: true,
      waived: dueCents === 0 && listCents > 0,
      listCents,
      dueCents,
      discountCents: lineDiscount || sessionDiscount,
      monthlyCents,
    };
  }

  const total = cents(session?.amount_total);
  if (total == null || !monthlyList) {
    return { known: false, waived: false, listCents: 0, dueCents: null, discountCents: sessionDiscount, monthlyCents: monthlyList };
  }
  const dueCents = total - monthlyList;
  if (dueCents < 0) {
    return { known: false, waived: false, listCents: 0, dueCents: null, discountCents: sessionDiscount, monthlyCents: monthlyList };
  }
  const listCents = dueCents + sessionDiscount;
  return {
    known: true,
    waived: dueCents === 0,
    listCents,
    dueCents,
    discountCents: sessionDiscount,
    monthlyCents: monthlyList,
  };
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
 * `lookupPromo` returns the human code or ''.
 * A non-retryable mail result (SendGrid 4xx other than 408/429) is logged and
 * saved, and the event is accepted so Stripe does not retry it forever.
 * A transient mail failure throws so the caller can return 500.
 */
export async function processStripeEvent({ event, store, env, send, lookupPromo, lookupLines, emailsFor }) {
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
  let priced = session;
  if (typeof lookupLines === 'function' && !sessionLineItems(session).length) {
    try {
      const lines = await lookupLines(session);
      if (Array.isArray(lines) && lines.length) priced = { ...session, line_items: { data: lines } };
    } catch (err) {
      console.error('[stripe-webhook] line items lookup failed', err?.name || 'error');
    }
  }
  const emails = emailsFor(priced, promo, env);
  let rejected = null;
  for (const email of emails) {
    const stamp = `${email.to}|${email.subject}`;
    if (state.sent.includes(stamp)) continue;
    const result = await send(email);
    if (!result?.ok) {
      if (result?.retryable === false) {
        rejected = result;
        state.status = 'mail_rejected';
        state.mailStatus = result.status || 0;
        console.error('[stripe-webhook] non-retryable mail failure', state.mailStatus);
        if (store) await store.set(key, state);
        continue;
      }
      if (store) await store.set(key, state);
      const err = new Error('mail');
      err.code = 'mail';
      throw err;
    }
    state.sent.push(stamp);
    if (store) await store.set(key, state);
  }
  if (rejected) {
    state.status = 'mail_rejected';
    state.mailStatus = rejected.status || state.mailStatus || 0;
    if (store) await store.set(key, state);
    return { action: 'accepted' };
  }
  state.status = 'sent';
  if (store) await store.set(key, state);
  return { action: 'sent' };
}
