import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeToken, clientReferenceId, checkoutParams, messageMatchVisible, appendCheckoutParams } from './ids.mjs';

describe('attribution ids', () => {
  it('strips unsafe characters and caps length', () => {
    assert.equal(sanitizeToken('cold preview!<script>', 8), 'coldprev');
    assert.equal(sanitizeToken('ok_name-1', 150), 'ok_name-1');
  });

  it('builds a reference id with no email or spaces', () => {
    const id = clientReferenceId({
      visitId: 'abc123def456',
      utmSource: 'test',
      utmCampaign: 'cold-preview',
    });
    assert.match(id, /^[A-Za-z0-9_-]{1,200}$/);
    assert.equal(id.includes('@'), false);
    assert.match(id, /^v-abc123def456_s-test_c-cold-preview$/);
  });

  it('prefers the check id and only adds prefilled_email when given', () => {
    const withEmail = checkoutParams({
      utm: { utm_source: 'test', utm_campaign: 'cold-preview' },
      visitId: 'abc123def456',
      checkId: 'chk1',
      email: 'tim+test@revvia.com',
    });
    assert.match(withEmail.client_reference_id, /^c-chk1_/);
    assert.equal(withEmail.prefilled_email, 'tim+test@revvia.com');

    const before = checkoutParams({
      utm: { utm_source: 'test', utm_campaign: 'cold-preview' },
      visitId: 'abc123def456',
    });
    assert.equal(before.prefilled_email, undefined);
  });

  it('shows the message-match line only for cold campaigns or found-outbound', () => {
    assert.equal(messageMatchVisible({ utm_campaign: 'cold-preview' }), true);
    assert.equal(messageMatchVisible({ utm_source: 'found-outbound' }), true);
    assert.equal(messageMatchVisible({ utm_campaign: 'newsletter' }), false);
    assert.equal(messageMatchVisible({}), false);
  });

  it('appends params onto the plain Payment Link', () => {
    const href = appendCheckoutParams('https://buy.stripe.com/keep', {
      utm_source: 'test',
      client_reference_id: 'v-abc_s-test_c-cold-preview',
    });
    const url = new URL(href);
    assert.equal(url.searchParams.get('utm_source'), 'test');
    assert.match(url.searchParams.get('client_reference_id'), /^[A-Za-z0-9_-]{1,200}$/);
  });
});
