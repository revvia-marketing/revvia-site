import { json } from './_lib/http.mjs';

export const config = { path: '/api/founding' };

/**
 * Read-only founding counter. GET only.
 * Returns { ok: false } unless a restricted Stripe key and the promo code
 * are both set. The promo code is never written into the response.
 */
export default async (req) => {
  if (req.method !== 'GET') return json({ ok: false }, 405);
  const key = process.env.STRIPE_RESTRICTED_KEY_READ;
  const code = process.env.FOUNDING_PROMO_CODE;
  if (!key || !code) return json({ ok: false });

  try {
    const url = new URL('https://api.stripe.com/v1/promotion_codes');
    url.searchParams.set('code', code);
    url.searchParams.set('limit', '1');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[founding] stripe read failed', res.status);
      return json({ ok: false });
    }
    const data = await res.json();
    const promo = (data.data || []).find((row) => row && row.code === code);
    if (!promo || typeof promo.times_redeemed !== 'number') return json({ ok: false });
    const left = Math.max(0, 10 - promo.times_redeemed);
    return json({ ok: true, left }, 200, { 'cache-control': 'public, max-age=600' });
  } catch (err) {
    console.error('[founding] failed', err?.name || 'error');
    return json({ ok: false });
  }
};
