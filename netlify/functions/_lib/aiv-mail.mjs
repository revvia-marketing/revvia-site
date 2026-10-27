import { signOff, TIM_EMAIL } from './mail.mjs';
import { signBillingToken } from './billing-token.mjs';
import {
  customFieldValue,
  customerEmail,
  customerName,
  describeCharges,
  formatAddress,
  formatDollars,
  planFromSession,
  stripeId,
} from './stripe-sale.mjs';

export const SETUP_DAYS = 21;

export function siteOrigin(env = process.env) {
  return String(env.PUBLIC_SITE_URL || 'https://revvia.com').replace(/\/$/, '');
}

export function unsubscribeUrl(env = process.env) {
  return `${siteOrigin(env)}/unsubscribe`;
}

export function firstName(name) {
  const n = String(name || '').trim().split(/\s+/)[0];
  return n || 'there';
}

export function intakeUrl({ email, website, founding, env = process.env }) {
  const url = new URL('/ai-visibility/intake/', `${siteOrigin(env)}/`);
  if (email) url.searchParams.set('email', email);
  if (website) url.searchParams.set('website', website);
  if (founding) url.searchParams.set('founding', '1');
  return url.toString();
}

export function billingPageUrl(customerId, env = process.env) {
  const token = signBillingToken(customerId, env.BILLING_LINK_SECRET);
  if (!token) return '';
  return `${siteOrigin(env)}/.netlify/functions/billing-link?token=${encodeURIComponent(token)}`;
}

function optInFooter(env) {
  return `You're getting this because you asked for your AI Visibility Check at revvia.com. If you don't want any more emails, reply "unsubscribe" or use this link: ${unsubscribeUrl(env)}\n`;
}

export function saleFromSession(session, promo, env = process.env) {
  const plan = planFromSession(session);
  const email = customerEmail(session);
  const name = customerName(session);
  const code = String(promo || '').trim();
  const upper = code.toUpperCase();
  const configured = String(env.FOUNDING_PROMO_CODE || '').trim().toUpperCase();
  const founding = upper === 'FOUNDING10' || Boolean(configured && upper === configured);
  const setup = describeCharges(session, plan);
  return {
    plan,
    promo: code || 'none',
    founding,
    setup,
    setupWaived: setup.known ? setup.waived : founding,
    amount: formatDollars(session?.amount_total),
    customerName: name || 'there',
    firstName: firstName(name),
    email,
    website: customFieldValue(session, 'businesswebsite') || 'none',
    caseStudy: customFieldValue(session, 'casestudypermission') || 'not collected',
    billingAddress: formatAddress(session?.customer_details?.address),
    customerId: stripeId(session?.customer, 'cus_'),
    subscriptionId: stripeId(session?.subscription, 'sub_'),
  };
}

/** Paid setup keeps the $497 refund promise. A waived setup uses the page's founding line. */
export function guaranteeSentence(waived) {
  if (waived) {
    return `Setup is delivered within ${SETUP_DAYS} days of your completed intake and manager access. If your setup was waived through the founding offer, there's no setup fee to refund.`;
  }
  return `Setup is delivered within ${SETUP_DAYS} days of your completed intake, or you get your $497 setup fee back.`;
}

function dollars(cents) {
  return `$${formatDollars(cents)}`;
}

function setupPhrase(setup) {
  if (!setup?.known) return 'not on the checkout session';
  if (setup.waived) {
    return setup.listCents > 0 ? `waived (${dollars(setup.listCents)} not charged)` : 'waived';
  }
  return dollars(setup.dueCents);
}

export function welcomeEmail(sale, env = process.env) {
  const link = billingPageUrl(sale.customerId, env);
  const billing = link
    ? link
    : 'Reply to this email and I will send your billing link.';
  const body = `Hi ${sale.firstName},

Thanks for signing up for Revvia AI Visibility ${sale.plan.name}. Your payment went through, and Stripe has emailed your receipt.

To start setup, I need about 10 minutes of your time on one short form:

${intakeUrl({ email: sale.email, website: sale.website === 'none' ? '' : sale.website, founding: sale.founding, env })}

It asks for:
- Your business name exactly as it appears on Google, plus your phone number and main address or service area
- The trades and services you want to be found for, and the cities you serve
- Your hours
- 2 or 3 competitors you see winning jobs in your area
- Your Google Business Profile link

It also asks you to add me as a Manager on your Google Business Profile so I can make the updates for you. The form walks you through it. It takes about 2 minutes, and you can remove me at any time.

${guaranteeSentence(sale.setupWaived)} The clock starts when the form comes in, so the sooner you send it, the sooner you'll see changes.

To update your card, see invoices, or cancel, use your private billing link:

${billing}

Please don't share it. It opens your account without a password.

If anything on the form is unclear, just reply to this email.`;
  return {
    to: sale.email,
    subject: "You're in. One short form to start your AI Visibility setup",
    text: signOff(body),
  };
}

export function saleAlertEmail(sale, env = process.env) {
  const monthlyCents = sale.setup?.monthlyCents || (sale.plan.monthly ? sale.plan.monthly * 100 : 0);
  const planLine = monthlyCents ? `${sale.plan.name} (${dollars(monthlyCents)}/mo)` : sale.plan.name;
  const discount = sale.setup?.discountCents > 0 ? `\nDiscount: ${dollars(sale.setup.discountCents)}` : '';
  const customerUrl = sale.customerId
    ? `https://dashboard.stripe.com/customers/${sale.customerId}`
    : 'not available';
  const subscriptionUrl = sale.subscriptionId
    ? `https://dashboard.stripe.com/subscriptions/${sale.subscriptionId}`
    : 'not available';
  const welcome = sale.email
    ? 'The welcome email with the intake form and private billing link was sent to the buyer.'
    : 'No buyer email was on the checkout, so the welcome email was not sent.';
  const billingNote = sale.customerId && !billingPageUrl(sale.customerId, env)
    ? '\nBilling link was not included. BILLING_LINK_SECRET is not set.'
    : '';
  const body = `New AI Visibility checkout.

Plan: ${planLine}
Setup: ${setupPhrase(sale.setup)}
Promo code: ${sale.promo}
Amount paid today: $${sale.amount}${discount}
Customer: ${sale.customerName}
Email: ${sale.email || 'none'}
Business website: ${sale.website}
Case-study permission: ${sale.caseStudy}
Billing address: ${sale.billingAddress}
Stripe customer: ${customerUrl}
Subscription: ${subscriptionUrl}

Next step: ${welcome}${billingNote}`;
  return {
    to: TIM_EMAIL,
    subject: `New AI Visibility sale: ${sale.plan.name} from ${sale.customerName}`,
    text: signOff(body),
  };
}

/** Buyer welcome first, then Tim, so a retry can skip whichever already went out. */
export function saleEmails(session, promo, env = process.env) {
  const sale = saleFromSession(session, promo, env);
  const emails = [];
  if (sale.email) emails.push(welcomeEmail(sale, env));
  emails.push(saleAlertEmail(sale, env));
  return emails;
}

export function consentGiven(data) {
  const raw = data?.consent;
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return false;
  return !['no', 'false', 'off', '0'].includes(s);
}

function lines(pairs) {
  return pairs
    .map(([label, value]) => `${label}: ${value || 'none'}`)
    .join('\n');
}

export function checkConfirmationEmail(data, env = process.env) {
  const name = firstName(data?.name);
  const body = `Hi ${name},

Your full report is coming within 1 business day. A person checks it before it goes out.`;
  return {
    to: String(data?.email || '').trim(),
    subject: 'Your AI Visibility Check is on the way',
    text: `${signOff(body)}\n${optInFooter(env)}`,
  };
}

export function checkNotifyEmail(data) {
  const body = `New AI Visibility Check request.

${lines([
    ['Name', data?.name],
    ['Email', data?.email],
    ['Business', data?.business],
    ['City', data?.city],
    ['Trade', data?.trade],
    ['Website', data?.website || (data?.no_website ? 'no website' : '')],
    ['Named count', data?.named_count],
    ['ChatGPT', data?.chatgpt_count],
    ['Perplexity', data?.perplexity_count],
    ['Claude', data?.claude_count],
    ['Check mode', data?.check_mode],
    ['Check id', data?.check_id],
    ['Consent', consentGiven(data) ? 'yes' : 'no'],
  ])}

Template 05 (the full report) is not sent automatically.`;
  return {
    to: TIM_EMAIL,
    subject: `AI Visibility Check: ${data?.business || 'new request'}`,
    text: signOff(body),
  };
}

const INTAKE_FIELDS = [
  ['name', 'Name'],
  ['email', 'Email used at checkout'],
  ['business_name', 'Business name'],
  ['phone', 'Phone'],
  ['website', 'Website'],
  ['trade', 'Primary trade'],
  ['services', 'Services'],
  ['service_area', 'Cities / service area'],
  ['hours', 'Hours'],
  ['gbp_link', 'Google Business Profile link'],
  ['gbp_manager', 'Added tim@revvia.com as Manager'],
  ['competitors', 'Competitors'],
  ['never_say', 'Never say'],
  ['case_study', 'Case-study permission'],
  ['best_time', 'Best phone/time'],
  ['founding_offer', 'Founding offer'],
];

const SKIP_FIELDS = new Set([
  'form-name',
  'bot-field',
  'company',
  ...INTAKE_FIELDS.map(([key]) => key),
]);

function extraFields(data) {
  const out = [];
  for (const [key, value] of Object.entries(data || {})) {
    if (SKIP_FIELDS.has(key)) continue;
    const text = Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
    if (!text) continue;
    out.push([key, text]);
  }
  return out;
}

export function intakeNotifyEmail(data) {
  const pairs = INTAKE_FIELDS.map(([key, label]) => [label, data?.[key]]);
  const body = `New AI Visibility intake.

${lines([...pairs, ...extraFields(data)])}`;
  const business = data?.business_name || data?.name || 'new client';
  return {
    to: TIM_EMAIL,
    subject: `AI Visibility intake: ${business}`,
    text: signOff(body),
  };
}

function foundingIntake(data) {
  const raw = data?.founding_offer;
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  return String(value || '').trim().toLowerCase() === 'yes';
}

export function intakeConfirmationEmail(data) {
  const name = firstName(data?.name);
  const business = String(data?.business_name || 'your business').trim();
  const body = `Hi ${name},

I have your intake for ${business}. ${guaranteeSentence(foundingIntake(data))}

If anything looks off, just reply.`;
  return {
    to: String(data?.email || '').trim(),
    subject: 'Got your AI Visibility intake',
    text: signOff(body),
  };
}

export function unsubscribeNotifyEmail(data) {
  const body = `Unsubscribe request.

Email: ${data?.email || 'none'}
Note: ${data?.message || 'none'}`;
  return {
    to: TIM_EMAIL,
    subject: `Unsubscribe: ${data?.email || 'request'}`,
    text: signOff(body),
  };
}

export function unsubscribeConfirmationEmail(data) {
  const body = `Hi,

You're unsubscribed from Revvia follow-up emails. You won't get further marketing emails from us at ${data?.email || 'this address'}.`;
  return {
    to: String(data?.email || '').trim(),
    subject: "You're unsubscribed",
    text: signOff(body),
  };
}

export function recordIntake(data) {
  const email = String(data?.email || '').trim().toLowerCase();
  if (!email) return null;
  return {
    key: `intake:${email}`,
    value: {
      email,
      at: new Date().toISOString(),
      business: String(data?.business_name || '').trim(),
      founding: String(data?.founding_offer || '').trim(),
      caseStudy: String(data?.case_study || '').trim(),
    },
  };
}
