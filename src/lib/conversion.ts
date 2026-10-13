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

export type ConvKey = 'real-cost' | 'scorecard' | 'ai-snapshot';

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

const CONV_TTL_MS = 30 * 60 * 1000;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/** Record a pending conversion right before navigating to the confirmation page. */
export function markConversion(key: ConvKey, eventId: string): void {
  try {
    sessionStorage.setItem(
      'rv_conv',
      JSON.stringify({ page: key, event_id: eventId, ts: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

function fireAll(key: ConvKey, eventId: string): void {
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
  let data: { page?: string; event_id?: string; ts?: number } | null = null;
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
      fireAll(key, eventId);
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
      markConversion(key, eventId);
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
