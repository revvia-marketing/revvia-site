import { sendPlain } from './_lib/mail.mjs';
import { verifyStripeSignature } from './_lib/stripe-sign.mjs';
import { saleEmails } from './_lib/aiv-mail.mjs';
import { openBlobStore } from './_lib/store.mjs';
import { processStripeEvent, promotionRefs, sessionLineItems } from './_lib/stripe-sale.mjs';

/**
 * Stripe webhook for Revvia AI Visibility.
 *
 * Register in the First Door live Stripe account:
 *   URL:    https://revvia.com/.netlify/functions/stripe-webhook
 *   Events: checkout.session.completed
 *
 * Env (names only; set in Netlify, never in the repo):
 *   STRIPE_WEBHOOK_SECRET  required. Signing secret for this endpoint.
 *   STRIPE_SECRET_KEY      required for promo-code lookup. A restricted read
 *                          key also works for that lookup (STRIPE_RESTRICTED_KEY_READ).
 *   BILLING_LINK_SECRET    required so the welcome email can include a billing link.
 *   SENDGRID_API_KEY       already used by the site.
 *   PUBLIC_SITE_URL        optional. Defaults to https://revvia.com.
 *
 * The signature is checked against the raw body. Idempotent on the Stripe event id.
 */

function stripeKey(env) {
  return env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY_READ || '';
}

export async function lookupPromoCode(session, env = process.env, fetchImpl = fetch) {
  const refs = promotionRefs(session);
  if (refs.codes.length) return refs.codes.join(', ');
  if (!refs.ids.length) return '';
  const key = stripeKey(env);
  if (!key) return '';
  const codes = [];
  for (const id of refs.ids) {
    if (!/^promo_[A-Za-z0-9]+$/.test(id)) continue;
    try {
      const res = await fetchImpl(`https://api.stripe.com/v1/promotion_codes/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.code) codes.push(String(data.code));
    } catch (err) {
      console.error('[stripe-webhook] promo lookup failed', err?.name || 'error');
    }
  }
  return codes.join(', ');
}

export async function lookupSessionLineItems(session, env = process.env, fetchImpl = fetch) {
  const present = sessionLineItems(session);
  if (present.length) return present;
  const id = session?.id;
  const key = stripeKey(env);
  if (!key || typeof id !== 'string' || !/^cs_[A-Za-z0-9]+$/.test(id)) return [];
  try {
    const res = await fetchImpl(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}/line_items?limit=10`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch (err) {
    console.error('[stripe-webhook] line items lookup failed', err?.name || 'error');
    return [];
  }
}

export async function handleStripeWebhook(req, { env = process.env, fetchImpl = fetch, store, send = sendPlain } = {}) {
  try {
    if (req.method !== 'POST') return text('Method not allowed', 405);
    const raw = await req.text();
    const header = req.headers.get('stripe-signature') || '';
    const verified = verifyStripeSignature(raw, header, env.STRIPE_WEBHOOK_SECRET || '');
    if (!verified.ok) return text('Invalid signature', 400);

    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return text('Invalid payload', 400);
    }

    const blob = store === undefined ? await openBlobStore('ai-visibility-events') : store;
    const result = await processStripeEvent({
      event,
      store: blob,
      env,
      send: (email) => send({ ...email, env, fetchImpl }),
      lookupPromo: (session) => lookupPromoCode(session, env, fetchImpl),
      lookupLines: (session) => lookupSessionLineItems(session, env, fetchImpl),
      emailsFor: saleEmails,
    });
    return text(result.action || 'ok', 200);
  } catch (err) {
    console.error('[stripe-webhook]', err?.code || err?.name || 'error');
    return text('Retry', 500);
  }
}

function text(body, status) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

export default async (req) => handleStripeWebhook(req);
