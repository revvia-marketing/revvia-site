// netlify/functions/submission-created.mjs
//
// Netlify Forms auto-responder. Netlify invokes a function named exactly
// "submission-created" on every verified form submission. We branch on the
// form name and email the LEAD (from tim@revvia.com via SendGrid) so the
// "we emailed you a copy" promise on the thanks pages is true, and every lead
// gets a clear next step (read the guide / see the score / book the call).
//
// Required env (set in Netlify, never in the repo):
//   SENDGRID_API_KEY            - SendGrid API key (secret)
// Optional env:
//   FROM_EMAIL                  - defaults to tim@revvia.com (must be a domain
//                                 you've authenticated in SendGrid)
//   BOOKING_URL                 - general "book a call" link for the guide +
//                                 scorecard emails (defaults to the snapshot
//                                 Calendly, then to the contact page)
//   PUBLIC_SNAPSHOT_BOOKING_URL - the 30-min AI-snapshot Calendly link
//
// Meta Conversions API (server-side Lead, deduped with the browser Pixel via
// the form's event_id). Skipped quietly if either is missing:
//   META_CAPI_TOKEN             - Conversions API access token (secret)
//   PUBLIC_META_PIXEL_ID        - the Pixel/dataset id (already set for the site)
//   META_TEST_EVENT_CODE        - optional; set only while testing in Events Manager

import { createHash } from 'node:crypto';

/** Forms that fire a browser Pixel `Lead`; the server sends the same event. */
const CAPI_LEAD_FORMS = {
  'real-cost-guide': 'Real Cost Guide',
  'marketing-scorecard': 'Marketing Scorecard',
  'ai-snapshot-request': 'AI Snapshot Request',
  'growth-audit': 'Growth Audit',
  'ai-visibility-audit': 'AI Visibility Audit',
  'geo-scorecard-request': 'GEO Scorecard',
  'geo-landing-contact': 'GEO Contact',
};

function sha256(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s ? createHash('sha256').update(s).digest('hex') : undefined;
}

function digits(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d; // US numbers need the country code
  return d;
}

/** Send one server-side Lead to Meta. Never throws. */
async function sendMetaLead(formName, data, payload) {
  const token = process.env.META_CAPI_TOKEN;
  const pixel = process.env.PUBLIC_META_PIXEL_ID || process.env.META_PIXEL_ID;
  const offer = CAPI_LEAD_FORMS[formName];
  if (!token || !pixel || !offer) return;
  try {
    const nameParts = String(data.name || '').trim().split(/\s+/);
    const user_data = {
      em: sha256(data.email) ? [sha256(data.email)] : undefined,
      ph: digits(data.phone) ? [sha256(digits(data.phone))] : undefined,
      fn: sha256(nameParts[0]) ? [sha256(nameParts[0])] : undefined,
      ln: nameParts.length > 1 ? [sha256(nameParts[nameParts.length - 1])] : undefined,
      fbc: data.fbc || undefined,
      fbp: data.fbp || undefined,
      client_ip_address: data.ip || undefined,
      client_user_agent: data.user_agent || undefined,
      country: [sha256('us')],
    };
    const created = Date.parse(payload.created_at || '') || Date.now();
    const body = {
      data: [
        {
          event_name: 'Lead',
          event_time: Math.floor(created / 1000),
          event_id: data.event_id || payload.id || undefined,
          action_source: 'website',
          event_source_url: data.landing_url || data.referrer || 'https://revvia.com/',
          user_data,
          custom_data: {
            content_name: offer,
            form_name: formName,
            lead_source: data.utm_source || (data.gclid ? 'google' : data.fbclid ? 'meta' : 'organic'),
          },
        },
      ],
    };
    if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) {
      console.error('[submission-created] Meta CAPI error', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[submission-created] Meta CAPI exception', err);
  }
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'tim@revvia.com';
const FROM_NAME = 'Tim Holt, Revvia';
const SNAPSHOT_URL =
  process.env.PUBLIC_SNAPSHOT_BOOKING_URL || 'https://revvia.com/ai-snapshot';
const BOOKING_URL =
  process.env.BOOKING_URL ||
  'https://calendly.com/tim-revvia/discovery-call-revvia';

/** Append UTM tags so Calendly records which lead magnet the booking came from. */
function withUtm(url, source) {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', 'email');
    u.searchParams.set('utm_campaign', 'lead-magnet');
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}utm_source=${encodeURIComponent(source)}&utm_medium=email&utm_campaign=lead-magnet`;
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstName(name) {
  const n = String(name || '').trim().split(/\s+/)[0];
  return n ? esc(n) : 'there';
}

/** Wrap body HTML in a simple, deliverable, light-theme shell. */
function shell(bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a1c22;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e6eb;">
          <tr><td style="padding:26px 30px 8px;">
            <div style="font-weight:800;font-size:20px;letter-spacing:-0.5px;color:#0a0a0c;">Revvia</div>
          </td></tr>
          <tr><td style="padding:8px 30px 30px;font-size:16px;line-height:1.6;color:#2a2d36;">
            ${bodyHtml}
          </td></tr>
        </table>
        <div style="max-width:520px;color:#9299a6;font-size:12px;line-height:1.5;padding:16px 30px;">
          Revvia Marketing (First Door, LLC) &middot; Carlsbad, CA &middot; (760) 782-2875<br>
          You're getting this because you reached out through revvia.com.
        </div>
      </td></tr>
    </table>
  </body></html>`;
}

function button(url, label) {
  return `<a href="${esc(url)}" style="display:inline-block;background:#d6248f;background:linear-gradient(115deg,#8a0fad,#d6248f,#ec4f65,#fe9c1c);color:#ffffff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;font-size:16px;">${esc(label)}</a>`;
}

/** Build { subject, html, text } for a given form + submission data. */
function buildEmail(formName, data) {
  const hi = firstName(data.name);

  if (formName === 'real-cost-guide') {
    const guide = 'https://revvia.com/guides/real-cost';
    const book = withUtm(BOOKING_URL, 'real-cost');
    return {
      subject: 'Your guide: Hire, Agency, or Fractional?',
      text: `Hi ${firstNamePlain(data.name)},\n\nThanks for grabbing the guide. Read the full version here:\n${guide}\n\nIt breaks down what a full-time hire, an agency, and a fractional CMO really cost in San Diego, and which one fits your stage.\n\nWhen you want a second opinion on your situation, grab a time with me:\n${book}\n\n- Tim Holt, Revvia`,
      html: shell(
        `<p>Hi ${hi},</p>
         <p>Thanks for grabbing the guide. Here's the full version:</p>
         <p>${button(guide, 'Read the guide')}</p>
         <p>It breaks down what a full-time hire, an agency, and a fractional CMO really cost in San Diego, and how to tell which one fits your stage right now.</p>
         <p>When you want a second opinion on your situation, grab a time with me:</p>
         <p>${button(book, 'Book a call')}</p>
         <p>- Tim Holt, Revvia</p>`
      ),
    };
  }

  if (formName === 'marketing-scorecard') {
    const score = esc(data.score);
    const tier = esc(data.tier);
    const gap = esc(data.weakest_area);
    const book = withUtm(BOOKING_URL, 'scorecard');
    return {
      subject: `Your Marketing Scorecard: ${score}/20`,
      text: `Hi ${firstNamePlain(data.name)},\n\nThanks for taking the scorecard. You scored ${data.score}/20 - ${data.tier}.\n\nYour biggest gap right now: ${data.weakest_area}.\n\nThat's the fastest place to find growth. Want to talk through how to close it? Grab a time:\n${book}\n\n- Tim Holt, Revvia`,
      html: shell(
        `<p>Hi ${hi},</p>
         <p>Thanks for taking the scorecard. Here's where you landed:</p>
         <p style="font-size:22px;font-weight:800;color:#0a0a0c;margin:6px 0;">${score}/20 &mdash; ${tier}</p>
         <p>Your biggest gap right now: <strong>${gap}</strong>. That's usually the fastest place to find growth.</p>
         <p>Want to talk through how to close it? Grab a time:</p>
         <p>${button(book, 'Book a call')}</p>
         <p>- Tim Holt, Revvia</p>`
      ),
    };
  }

  if (formName === 'ai-snapshot-request') {
    const book = withUtm(SNAPSHOT_URL, 'ai-snapshot');
    return {
      subject: "Your AI Visibility Snapshot - let's lock a time",
      text: `Hi ${firstNamePlain(data.name)},\n\nThanks for requesting your AI Visibility Snapshot.\n\nThe next step is a quick 30-minute Zoom where I walk you through how you and your competitors show up when people ask ChatGPT and Google AI Mode for a business like yours.\n\nPick a time here:\n${book}\n\nI'll build your snapshot before we talk, using the competitors you shared.\n\n- Tim Holt, Revvia`,
      html: shell(
        `<p>Hi ${hi},</p>
         <p>Thanks for requesting your AI Visibility Snapshot.</p>
         <p>The next step is a quick 30-minute Zoom where I walk you through how you and your competitors show up when people ask ChatGPT and Google AI Mode for a business like yours.</p>
         <p>${button(book, 'Pick your time')}</p>
         <p>I'll build your snapshot before we talk, using the competitors you shared.</p>
         <p>- Tim Holt, Revvia</p>`
      ),
    };
  }

  return null; // not one of our lead forms - no email
}

function firstNamePlain(name) {
  const n = String(name || '').trim().split(/\s+/)[0];
  return n || 'there';
}

async function sendViaSendGrid({ to, subject, html, text }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn('[submission-created] SENDGRID_API_KEY not set - skipping send.');
    return;
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[submission-created] SendGrid error', res.status, body);
  }
}

export const handler = async (event) => {
  try {
    const parsed = JSON.parse(event.body || '{}');
    const payload = parsed.payload || {};
    const data = payload.data || {};
    const formName = payload.form_name || data['form-name'];
    const to = data.email || payload.email;

    if (!formName) return { statusCode: 200, body: 'no-op' };

    // Server-side Meta Lead runs for every lead form, independent of email.
    const capi = sendMetaLead(formName, data, payload);

    const email = to ? buildEmail(formName, data) : null;
    if (email) await sendViaSendGrid({ to, ...email });
    await capi;
    return { statusCode: 200, body: email ? 'sent' : 'ignored' };
  } catch (err) {
    // Never fail the submission because of the auto-responder.
    console.error('[submission-created] error', err);
    return { statusCode: 200, body: 'error-handled' };
  }
};
