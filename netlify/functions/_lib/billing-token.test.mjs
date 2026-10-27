import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { customerIdFromToken, signBillingToken } from './billing-token.mjs';
import { handleBillingRequest } from '../billing-link.mjs';

describe('billing token', () => {
  const secret = ['unit', 'billing', 'secret'].join('-');

  it('round-trips a customer id and rejects a swapped id', () => {
    const token = signBillingToken('cus_Abc123', secret);
    assert.equal(customerIdFromToken(token, secret), 'cus_Abc123');
    const [body, sig] = token.split('.');
    const other = Buffer.from('cus_Other999', 'utf8').toString('base64url');
    assert.equal(customerIdFromToken(`${other}.${sig}`, secret), '');
    assert.equal(customerIdFromToken(token, 'other-secret'), '');
    assert.equal(signBillingToken('not-a-customer', secret), '');
  });
});

describe('billing link handler', () => {
  const secret = ['unit', 'billing', 'secret'].join('-');
  const key = ['unit', 'stripe', 'key'].join('-');

  it('redirects a valid token to a new portal session and hides why a bad token failed', async () => {
    const token = signBillingToken('cus_Abc123', secret);
    let posted = null;
    const ok = await handleBillingRequest(new Request(`https://revvia.com/.netlify/functions/billing-link?token=${encodeURIComponent(token)}`), {
      env: { BILLING_LINK_SECRET: secret, STRIPE_SECRET_KEY: key, PUBLIC_SITE_URL: 'https://revvia.com' },
      fetchImpl: async (_url, init) => {
        posted = init;
        return new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/session/test-session' }), { status: 200 });
      },
    });
    assert.equal(ok.status, 303);
    assert.equal(ok.headers.get('location'), 'https://billing.stripe.com/p/session/test-session');
    assert.match(String(posted.body), /customer=cus_Abc123/);
    assert.match(String(posted.headers.Authorization), new RegExp(key));

    const bad = await handleBillingRequest(new Request('https://revvia.com/.netlify/functions/billing-link?token=nope'), {
      env: { BILLING_LINK_SECRET: secret, STRIPE_SECRET_KEY: key },
    });
    const html = await bad.text();
    assert.match(html, /Reply to any Revvia email/);
    assert.equal(html.includes('invalid'), false);
    assert.equal(html.includes('token'), false);
    assert.equal(html.includes(secret), false);
  });
});
