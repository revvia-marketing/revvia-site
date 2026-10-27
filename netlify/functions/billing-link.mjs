import { BILLING_PORTAL_CONFIGURATION, customerIdFromToken } from './_lib/billing-token.mjs';

/**
 * Fresh Stripe Customer Portal session per click.
 * GET /.netlify/functions/billing-link?token=...
 *
 * Env:
 *   BILLING_LINK_SECRET   HMAC secret. Required.
 *   STRIPE_SECRET_KEY     Secret key that can create portal sessions. Required.
 *                         STRIPE_RESTRICTED_KEY_READ cannot do this.
 *   PUBLIC_SITE_URL       optional return URL origin. Defaults to https://revvia.com.
 *
 * A bad token and a Stripe failure show the same page. The page does not say which one happened.
 */

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Billing link | Revvia</title>
</head>
<body style="margin:0;background:#0a0a0c;color:#f4f5f7;font-family:Georgia,serif;">
  <main style="max-width:36rem;margin:12vh auto;padding:0 1.5rem;line-height:1.5;">
    <p>We couldn't open your billing page. Reply to any Revvia email and we'll send a fresh link.</p>
  </main>
</body>
</html>`;

function page(status) {
  return new Response(PAGE, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function siteOrigin(env = process.env) {
  return String(env.PUBLIC_SITE_URL || 'https://revvia.com').replace(/\/$/, '');
}

export async function handleBillingRequest(req, { env = process.env, fetchImpl = fetch } = {}) {
  if (req.method !== 'GET') return page(405);
  let token = '';
  try {
    token = new URL(req.url).searchParams.get('token') || '';
  } catch {
    return page(400);
  }
  const customer = customerIdFromToken(token, env.BILLING_LINK_SECRET || '');
  const key = env.STRIPE_SECRET_KEY || '';
  if (!customer || !key) return page(400);

  try {
    const body = new URLSearchParams({
      customer,
      configuration: BILLING_PORTAL_CONFIGURATION,
      return_url: `${siteOrigin(env)}/ai-visibility`,
    });
    const res = await fetchImpl('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[billing-link] portal session failed', res.status);
      return page(502);
    }
    const data = await res.json();
    if (!data?.url || typeof data.url !== 'string') return page(502);
    return new Response(null, {
      status: 303,
      headers: { location: data.url, 'cache-control': 'no-store' },
    });
  } catch (err) {
    console.error('[billing-link]', err?.name || 'error');
    return page(502);
  }
}

export default async (req) => handleBillingRequest(req);
