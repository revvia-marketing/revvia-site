/**
 * Conversion firing (section 2d) + the lead-form submit helper (section 2e).
 *
 * A form writes `rv_conv` on a valid submit, then navigates to its confirmation
 * page. The confirmation page calls `fireConversion('<key>')`, which fires the
 * Meta Lead, Google Ads conversion, and GA4 generate_lead exactly once - only
 * if rv_conv matches the page and is under 30 minutes old - then removes rv_conv
 * immediately so a refresh, back button, or direct visit never double-counts.
 */
import { fillAttribution } from './attribution';

/** Landing-page offers: conversion fires on their own confirmation page. */
export type ConvKey = 'real-cost' | 'scorecard' | 'ai-snapshot';
/** In-page site forms: conversion fires right after a successful submit. */
export type SiteFormKey =
  | 'growth-audit'
  | 'ai-visibility-audit'
  | 'geo-scorecard-request'
  | 'geo-landing-contact';

const ADS_ID = import.meta.env.PUBLIC_GOOGLE_ADS_ID as string | undefined;
const LABELS: Record<ConvKey, string | undefined> = {
  'real-cost': import.meta.env.PUBLIC_GADS_LABEL_REAL_COST as string | undefined,
  scorecard: import.meta.env.PUBLIC_GADS_LABEL_SCORECARD as string | undefined,
  'ai-snapshot': import.meta.env.PUBLIC_GADS_LABEL_AI_SNAPSHOT as
    | string
    | undefined,
};

/** Human offer name sent as Meta content_name. */
const OFFER_NAME: Record<ConvKey, string> = {
  'real-cost': 'Real Cost Guide',
  scorecard: 'Marketing Scorecard',
  'ai-snapshot': 'AI Snapshot Request',
};

/** Netlify form name sent as GA4 form_name. */
const FORM_NAME: Record<ConvKey, string> = {
  'real-cost': 'real-cost-guide',
  scorecard: 'marketing-scorecard',
  'ai-snapshot': 'ai-snapshot-request',
};

/** Every in-page sales form counts as one Google Ads "Lead – Contact Form". */
const CONTACT_LABEL = import.meta.env.PUBLIC_GADS_LABEL_CONTACT as
  | string
  | undefined;

const SITE_FORM_OFFER: Record<SiteFormKey, string> = {
  'growth-audit': 'Growth Audit',
  'ai-visibility-audit': 'AI Visibility Audit',
  'geo-scorecard-request': 'GEO Scorecard',
  'geo-landing-contact': 'GEO Contact',
};

const CONV_TTL_MS = 30 * 60 * 1000;

type UserData = { email?: string; phone?: string };

/** E.164 for US numbers (what Google enhanced conversions expects). */
function e164(raw: string): string {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.startsWith('1')) return '+' + d;
  return d ? '+' + d : '';
}

function userDataFromForm(form?: HTMLFormElement | null): UserData {
  if (!form) return {};
  const v = (n: string) =>
    (form.querySelector<HTMLInputElement>(`[name="${n}"]`)?.value || '').trim();
  return { email: v('email').toLowerCase(), phone: v('phone') };
}

/** Google Ads enhanced conversions: gtag hashes these before sending. */
function setGoogleUserData(u: UserData): void {
  try {
    if (typeof window.gtag !== 'function') return;
    const ud: Record<string, string> = {};
    if (u.email) ud.email = u.email;
    const ph = e164(u.phone || '');
    if (ph) ud.phone_number = ph;
    if (Object.keys(ud).length) window.gtag('set', 'user_data', ud);
  } catch {
    /* ignore */
  }
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/** Record a pending conversion right before navigating to the confirmation page. */
export function markConversion(
  key: ConvKey,
  eventId: string,
  form?: HTMLFormElement | null
): void {
  try {
    // email/phone ride along (same-origin, removed the moment the conversion
    // fires) so the thanks page can send Google enhanced-conversion data.
    const u = userDataFromForm(form);
    sessionStorage.setItem(
      'rv_conv',
      JSON.stringify({ page: key, event_id: eventId, ts: Date.now(), u })
    );
  } catch {
    /* ignore */
  }
}

function fireAll(key: ConvKey, eventId: string, u: UserData = {}): void {
  setGoogleUserData(u);
  try {
    if (typeof window.fbq === 'function') {
      window.fbq(
        'track',
        'Lead',
        { content_name: OFFER_NAME[key] },
        { eventID: eventId }
      );
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof window.gtag === 'function') {
      if (ADS_ID && LABELS[key]) {
        window.gtag('event', 'conversion', {
          send_to: `${ADS_ID}/${LABELS[key]}`,
          transaction_id: eventId,
        });
      }
      window.gtag('event', 'generate_lead', {
        form_name: FORM_NAME[key],
        lead_source: key,
      });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Fire the three conversion events for `key`, once. Call from a confirmation
 * page. No-op (and fires nothing) on refresh, back, direct visit, or expiry.
 */
export function fireConversion(key: ConvKey): void {
  let data: {
    page?: string;
    event_id?: string;
    ts?: number;
    u?: UserData;
  } | null = null;
  try {
    const raw = sessionStorage.getItem('rv_conv');
    if (!raw) return;
    data = JSON.parse(raw);
  } catch {
    return;
  }
  if (!data || data.page !== key || !data.ts) return;
  // Remove immediately so a refresh / back / direct visit never double-counts.
  try {
    sessionStorage.removeItem('rv_conv');
  } catch {
    /* ignore */
  }
  if (Date.now() - data.ts > CONV_TTL_MS) return;

  const eventId = data.event_id || '';
  const start = Date.now();
  // Wait for slow tag loads: poll up to 5s, every 200ms.
  (function poll() {
    const ready =
      typeof window.fbq === 'function' && typeof window.gtag === 'function';
    if (ready || Date.now() - start > 5000) {
      fireAll(key, eventId, data?.u || {});
    } else {
      setTimeout(poll, 200);
    }
  })();
}

/**
 * Wire a lead form (section 2e): AJAX POST to Netlify, then on success write
 * rv_conv and navigate to `next`. On failure, show [data-error] and re-enable
 * the submit button. Returns nothing; attach once on load.
 */
export function wireLeadForm(
  form: HTMLFormElement,
  key: ConvKey,
  next: string,
  beforeNavigate?: (form: HTMLFormElement) => void
): void {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Honeypot: a filled bot-field means a bot - silently drop.
    const hp = form.querySelector<HTMLInputElement>('[name="bot-field"]');
    if (hp && hp.value) return;

    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const err = form.querySelector<HTMLElement>('[data-error]');
    const original = btn ? btn.textContent || '' : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }
    if (err) err.hidden = true;

    const eventId = fillAttribution(form);

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form) as never).toString(),
      });
      if (!res.ok) throw new Error('Bad response ' + res.status);
      markConversion(key, eventId, form);
      if (beforeNavigate) {
        try {
          beforeNavigate(form);
        } catch {
          /* never block navigation */
        }
      }
      window.location.assign(next);
    } catch {
      if (err) err.hidden = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = original || 'Submit';
      }
    }
  });
}

/**
 * Fire the lead conversion for an in-page site form (no confirmation page):
 * Meta Lead (eventID = event_id, deduped against the server-side Conversions
 * API event sent by netlify/functions/submission-created.mjs), Google Ads
 * "Lead – Contact Form" with enhanced conversions, and GA4 generate_lead.
 */
export function trackSiteLead(
  key: SiteFormKey,
  eventId: string,
  form?: HTMLFormElement | null
): void {
  setGoogleUserData(userDataFromForm(form));
  try {
    if (typeof window.fbq === 'function') {
      window.fbq(
        'track',
        'Lead',
        { content_name: SITE_FORM_OFFER[key] },
        eventId ? { eventID: eventId } : undefined
      );
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof window.gtag === 'function') {
      if (ADS_ID && CONTACT_LABEL) {
        window.gtag('event', 'conversion', {
          send_to: `${ADS_ID}/${CONTACT_LABEL}`,
          transaction_id: eventId,
        });
      }
      window.gtag('event', 'generate_lead', {
        currency: 'USD',
        value: 1,
        form_name: key,
        lead_source: key,
      });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Expose the helpers to the site's `is:inline` form scripts (which can't
 * import modules). Inline submit handlers call window.rvTrack.fill(form)
 * before posting and window.rvTrack.lead(key, eventId, form) after.
 */
export function installTrackingGlobal(): void {
  try {
    (window as unknown as { rvTrack: unknown }).rvTrack = {
      fill: (form: HTMLFormElement) => fillAttribution(form),
      lead: (key: SiteFormKey, eventId: string, form?: HTMLFormElement) =>
        trackSiteLead(key, eventId, form),
    };
  } catch {
    /* ignore */
  }
}
