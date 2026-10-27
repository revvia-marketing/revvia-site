import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from './engine.mjs';
import { sendPlain } from './mail.mjs';
import {
  checkConfirmationEmail,
  consentGiven,
  intakeConfirmationEmail,
  intakeNotifyEmail,
  intakeUrl,
  saleEmails,
  SETUP_DAYS,
} from './aiv-mail.mjs';
import { processStripeEvent } from './stripe-sale.mjs';
import { handleStripeWebhook } from '../stripe-webhook.mjs';
import { createHmac } from 'node:crypto';

const env = {
  PUBLIC_SITE_URL: 'https://revvia.com',
  BILLING_LINK_SECRET: ['unit', 'billing', 'secret'].join('-'),
  STRIPE_SECRET_KEY: ['unit', 'stripe', 'key'].join('-'),
  STRIPE_WEBHOOK_SECRET: ['unit', 'webhook', 'secret'].join('-'),
  SENDGRID_API_KEY: ['SG', 'unit', 'test'].join('.'),
};

function session(overrides = {}) {
  return {
    id: 'cs_test_123',
    object: 'checkout.session',
    amount_total: 29700,
    amount_subtotal: 79400,
    total_details: { amount_discount: 49700, amount_shipping: 0, amount_tax: 0 },
    line_items: {
      data: [
        {
          description: 'Revvia AI Visibility: Setup',
          amount_subtotal: 49700,
          amount_discount: 49700,
          amount_total: 0,
          quantity: 1,
          price: { type: 'one_time', unit_amount: 49700 },
        },
        {
          description: 'Revvia AI Visibility: Keep',
          amount_subtotal: 29700,
          amount_discount: 0,
          amount_total: 29700,
          quantity: 1,
          price: { type: 'recurring', unit_amount: 29700, recurring: { interval: 'month' } },
        },
      ],
    },
    customer: 'cus_Buyer123',
    subscription: 'sub_Buyer123',
    customer_details: {
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      address: { line1: '1 Main', city: 'Mesa', state: 'AZ', postal_code: '85201', country: 'US' },
    },
    metadata: { product_line: 'revvia_ai_visibility', plan: 'keep' },
    custom_fields: [
      { key: 'businesswebsite', type: 'text', text: { value: 'https://ada.example' } },
      { key: 'casestudypermission', type: 'dropdown', dropdown: { value: 'yes' } },
    ],
    payment_link: 'plink_1UUy77Di4PfrgafHmPyzn6oz',
    discounts: [{ promotion_code: 'promo_Founding' }],
    ...overrides,
  };
}

describe('sale emails', () => {
  it('tells Tim and the buyer, with a founding intake link and a private billing link', () => {
    const emails = saleEmails(session(), 'FOUNDING10', env);
    assert.equal(emails.length, 2);
    const [welcome, alert] = emails;
    assert.equal(welcome.to, 'ada@example.com');
    assert.match(welcome.subject, /You're in/);
    assert.match(welcome.text, /Thanks,\nTim\n$/);
    assert.equal(welcome.text.includes('check@'), false);
    assert.match(welcome.text, new RegExp(`within ${SETUP_DAYS} days`));
    assert.match(welcome.text, /there's no setup fee to refund/);
    assert.equal(welcome.text.includes('$497 setup fee back'), false);
    assert.match(welcome.text, /billing-link\?token=/);
    const intake = intakeUrl({ email: 'ada@example.com', website: 'https://ada.example', founding: true, env });
    assert.match(welcome.text, new RegExp(intake.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(intake, /founding=1/);
    assert.equal(alert.to, 'tim@revvia.com');
    assert.match(alert.subject, /New AI Visibility sale: Keep from Ada Lovelace/);
    assert.match(alert.text, /Promo code: FOUNDING10/);
    assert.match(alert.text, /Amount paid today: \$297/);
    assert.match(alert.text, /\$297\/mo/);
    assert.match(alert.text, /Setup: waived \(\$497 not charged\)/);
    assert.equal(alert.text.includes('+ $497 setup'), false);
    assert.match(alert.text, /https:\/\/ada\.example/);
    assert.match(alert.text, /Case-study permission: yes/);
    assert.match(alert.text, /https:\/\/dashboard\.stripe\.com\/customers\/cus_Buyer123/);
    assert.match(alert.text, /Thanks,\nTim\n$/);
    assert.equal(alert.text.includes('01-welcome'), false);
  });

  it('promises the setup refund only when the checkout charged setup', () => {
    const paid = session({
      amount_total: 79400,
      amount_subtotal: 79400,
      total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
      discounts: [],
      line_items: {
        data: [
          {
            description: 'Revvia AI Visibility: Setup',
            amount_subtotal: 49700,
            amount_discount: 0,
            amount_total: 49700,
            quantity: 1,
            price: { type: 'one_time', unit_amount: 49700 },
          },
          {
            description: 'Revvia AI Visibility: Keep',
            amount_subtotal: 29700,
            amount_discount: 0,
            amount_total: 29700,
            quantity: 1,
            price: { type: 'recurring', unit_amount: 29700, recurring: { interval: 'month' } },
          },
        ],
      },
    });
    const [welcome, alert] = saleEmails(paid, '', env);
    assert.match(welcome.text, /\$497 setup fee back/);
    assert.equal(welcome.text.includes('no setup fee to refund'), false);
    assert.match(alert.text, /Setup: \$497/);
    assert.match(alert.text, /Amount paid today: \$794/);
    assert.equal(alert.text.includes('waived'), false);
  });

  it('uses fetched line items when the checkout event left them off the session', async () => {
    const sent = [];
    const bare = session({ line_items: undefined, total_details: undefined, amount_total: 29700 });
    await processStripeEvent({
      event: { id: 'evt_lines', type: 'checkout.session.completed', data: { object: bare } },
      store: createMemoryStore(),
      env,
      send: async (email) => {
        sent.push(email);
        return { ok: true };
      },
      lookupPromo: async () => 'FOUNDING10',
      lookupLines: async () => session().line_items.data,
      emailsFor: saleEmails,
    });
    assert.match(sent[1].text, /Setup: waived \(\$497 not charged\)/);
    assert.equal(sent[0].text.includes('$497 setup fee back'), false);
  });

  it('ignores a checkout that is not AI Visibility and does not resend a finished event', async () => {
    const sent = [];
    const store = createMemoryStore();
    const send = async (email) => {
      sent.push(email.to);
      return { ok: true };
    };
    const other = await processStripeEvent({
      event: { id: 'evt_other', type: 'checkout.session.completed', data: { object: { metadata: { product_line: 'other' } } } },
      store,
      env,
      send,
      lookupPromo: async () => '',
      emailsFor: saleEmails,
    });
    assert.equal(other.action, 'ignore');
    assert.equal(sent.length, 0);

    const event = { id: 'evt_aiv', type: 'checkout.session.completed', data: { object: session() } };
    const first = await processStripeEvent({
      event,
      store,
      env,
      send,
      lookupPromo: async () => 'FOUNDING10',
      emailsFor: saleEmails,
    });
    const second = await processStripeEvent({
      event,
      store,
      env,
      send,
      lookupPromo: async () => 'FOUNDING10',
      emailsFor: saleEmails,
    });
    assert.equal(first.action, 'sent');
    assert.equal(second.action, 'duplicate');
    assert.deepEqual(sent, ['ada@example.com', 'tim@revvia.com']);
  });
});

describe('stripe webhook http', () => {
  it('rejects a bad signature and sends mail for a signed AI Visibility checkout', async () => {
    const payload = JSON.stringify({
      id: 'evt_http',
      type: 'checkout.session.completed',
      data: { object: session({ discounts: [{ promotion_code: { code: 'FOUNDING10' } }] }) },
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${ts}.${payload}`).digest('hex');
    const sent = [];
    const good = await handleStripeWebhook(new Request('https://revvia.com/.netlify/functions/stripe-webhook', {
      method: 'POST',
      headers: { 'stripe-signature': `t=${ts},v1=${sig}` },
      body: payload,
    }), {
      env,
      store: createMemoryStore(),
      fetchImpl: async () => new Response('{}', { status: 200 }),
      send: async (email) => {
        sent.push(email);
        return { ok: true };
      },
    });
    assert.equal(good.status, 200);
    assert.equal(sent.length, 2);
    assert.match(sent[0].text, /founding=1/);

    const bad = await handleStripeWebhook(new Request('https://revvia.com/.netlify/functions/stripe-webhook', {
      method: 'POST',
      headers: { 'stripe-signature': `t=${ts},v1=deadbeef` },
      body: payload,
    }), { env, store: createMemoryStore(), send: async () => ({ ok: true }) });
    assert.equal(bad.status, 400);
  });

  it('accepts a non-retryable SendGrid rejection and asks Stripe to retry a transient one', async () => {
    const payload = JSON.stringify({
      id: 'evt_mail',
      type: 'checkout.session.completed',
      data: { object: session({ discounts: [{ promotion_code: { code: 'FOUNDING10' } }] }) },
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${ts}.${payload}`).digest('hex');
    const request = () => new Request('https://revvia.com/.netlify/functions/stripe-webhook', {
      method: 'POST',
      headers: { 'stripe-signature': `t=${ts},v1=${sig}` },
      body: payload,
    });
    const store = createMemoryStore();
    const rejected = await handleStripeWebhook(request(), {
      env,
      store,
      fetchImpl: async () => new Response('{}', { status: 200 }),
      send: async () => ({ ok: false, status: 403, retryable: false }),
    });
    assert.equal(rejected.status, 200);
    assert.equal((await store.get('stripe:evt_mail')).status, 'mail_rejected');

    const transient = await handleStripeWebhook(request(), {
      env,
      store: createMemoryStore(),
      fetchImpl: async () => new Response('{}', { status: 200 }),
      send: async () => ({ ok: false, status: 502, retryable: true }),
    });
    assert.equal(transient.status, 500);
  });
});

describe('check and intake mail', () => {
  it('confirms an opted-in check without sending the full report', () => {
    assert.equal(consentGiven({ consent: 'yes' }), true);
    assert.equal(consentGiven({ consent: '' }), false);
    const email = checkConfirmationEmail({ name: 'Ada Lovelace', email: 'ada@example.com' }, env);
    assert.match(email.text, /within 1 business day/);
    assert.match(email.text, /Thanks,\nTim/);
    assert.match(email.text, /\/unsubscribe/);
    assert.equal(email.text.includes('Who was named instead'), false);
    const intake = intakeConfirmationEmail({ name: 'Ada', email: 'ada@example.com', business_name: 'Ada Plumbing' });
    assert.match(intake.text, /Ada Plumbing/);
    assert.match(intake.text, /\$497 setup fee back/);
    assert.match(intake.text, /Thanks,\nTim\n$/);
    const founding = intakeConfirmationEmail({
      name: 'Ada',
      email: 'ada@example.com',
      business_name: 'Ada Plumbing',
      founding_offer: 'yes',
    });
    assert.match(founding.text, /no setup fee to refund/);
    assert.equal(founding.text.includes('$497 setup fee back'), false);
    const notice = intakeNotifyEmail({ business_name: 'Ada Plumbing', email: 'ada@example.com' });
    assert.equal(notice.text.includes('Reminders stop'), false);
    assert.match(notice.text, /Ada Plumbing/);
  });
});

describe('sendPlain', () => {
  it('posts plain text from Tim Holt and does not include an html part', async () => {
    let body = null;
    const result = await sendPlain({
      to: 'ada@example.com',
      subject: 'Hello',
      text: 'Thanks,\nTim\n',
      env,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return new Response('', { status: 202 });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(body.from.email, 'tim@revvia.com');
    assert.equal(body.from.name, 'Tim Holt');
    assert.equal(body.reply_to.email, 'tim@revvia.com');
    assert.deepEqual(body.content.map((part) => part.type), ['text/plain']);

    const rejected = await sendPlain({
      to: 'ada@example.com',
      subject: 'Hello',
      text: 'Thanks,\nTim\n',
      env,
      fetchImpl: async () => new Response(JSON.stringify({
        errors: [{ message: 'The from address does not match a verified Sender Identity.' }],
      }), { status: 403 }),
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.retryable, false);
    assert.equal(rejected.status, 403);
  });
});
