/**
 * Client-side ad attribution (section 2c). Runs on EVERY page (BaseLayout +
 * LandingLayout), so a visitor who lands on any page from an ad keeps their
 * click id even if they convert on a different page or come back later.
 *
 * On load, `initAttribution()` captures ad click ids + UTMs from the URL into
 * sessionStorage AND localStorage (rv_ prefix, 90-day expiry, last ad touch
 * wins), records the first external referrer, and seeds the Meta `_fbc`
 * cookie from `fbclid`.
 * On submit, `fillAttribution(form)` writes the captured values (plus the
 * `_fbc`/`_fbp` cookies, a query-string-free landing_url, and a fresh event_id)
 * into whatever matching hidden inputs the form has, and returns the event_id.
 * Every storage/cookie read and write is wrapped in try/catch.
 */

const PREFIX = 'rv_';
const PARAMS = [
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

function ssSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(PREFIX + key, value);
  } catch {
    /* private mode / blocked storage */
  }
}

function ssGet(key: string): string {
  try {
    return sessionStorage.getItem(PREFIX + key) || '';
  } catch {
    return '';
  }
}

const LS_KEY = PREFIX + 'attr';
const LS_TTL_MS = 90 * 86400000;

/** Persisted attribution (survives the session). Expired data reads as empty. */
function lsRead(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const d = JSON.parse(raw);
    if (!d || !d.ts || Date.now() - d.ts > LS_TTL_MS) return {};
    return d.v || {};
  } catch {
    return {};
  }
}

function lsWrite(v: Record<string, string>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), v }));
  } catch {
    /* blocked storage */
  }
}

/** Session value first (this visit), then the persisted 90-day value. */
function getAttr(key: string): string {
  return ssGet(key) || lsRead()[key] || '';
}

function getCookie(name: string): string {
  try {
    const match = document.cookie.match(
      '(^|;)\\s*' + name + '\\s*=\\s*([^;]+)'
    );
    return match ? decodeURIComponent(match.pop() as string) : '';
  } catch {
    return '';
  }
}

function setCookie(name: string, value: string, days: number): void {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function uuid(): string {
  try {
    if (self.crypto && typeof self.crypto.randomUUID === 'function') {
      return self.crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

/** Run once per page load (from BaseLayout and LandingLayout). */
export function initAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh: Record<string, string> = {};
    PARAMS.forEach((k) => {
      const v = params.get(k);
      if (v) fresh[k] = v;
    });
    if (Object.keys(fresh).length) {
      // A new ad/UTM touch replaces the whole previous touch (last touch wins),
      // so a Google click doesn't keep an old Meta utm_source, and vice versa.
      PARAMS.forEach((k) => {
        try {
          sessionStorage.removeItem(PREFIX + k);
        } catch {
          /* ignore */
        }
      });
      Object.keys(fresh).forEach((k) => ssSet(k, fresh[k]));
      fresh.first_landing = window.location.origin + window.location.pathname;
      lsWrite(fresh);
      ssSet('first_landing', fresh.first_landing);
    }
    // First external referrer this session (search engine, AI assistant, etc.).
    const ref = document.referrer || '';
    if (!ssGet('referrer')) {
      let external = '';
      try {
        if (ref && new URL(ref).hostname.replace(/^www\./, '') !== window.location.hostname.replace(/^www\./, '')) {
          external = new URL(ref).origin + new URL(ref).pathname;
        }
      } catch {
        external = '';
      }
      ssSet('referrer', external || 'direct');
      if (!ssGet('first_landing')) {
        ssSet('first_landing', window.location.origin + window.location.pathname);
      }
    }
    const fbclid = params.get('fbclid');
    if (fbclid && !getCookie('_fbc')) {
      setCookie('_fbc', `fb.1.${Date.now()}.${fbclid}`, 90);
    }
  } catch {
    /* never block the page */
  }
}

/** The full attribution payload, including a fresh event_id. */
export function collectAttribution(): Record<string, string> {
  let urlParams: URLSearchParams | null = null;
  try {
    urlParams = new URLSearchParams(window.location.search);
  } catch {
    urlParams = null;
  }
  const out: Record<string, string> = {};
  PARAMS.forEach((k) => {
    out[k] = (urlParams ? urlParams.get(k) || '' : '') || getAttr(k);
  });
  out.fbc = getCookie('_fbc');
  out.fbp = getCookie('_fbp');
  // URLs deliberately exclude the query string (no PII/click-ids in them).
  // landing_url = the page the form was submitted on (kept for back-compat);
  // first_landing = where this visitor first arrived from the ad / referrer.
  // traffic_referrer = the external site that sent them (Netlify reserves
  // the field name "referrer" for the submitting page, so it can't be used).
  out.landing_url = window.location.origin + window.location.pathname;
  out.first_landing = getAttr('first_landing') || out.landing_url;
  out.traffic_referrer = ssGet('referrer') || '';
  out.event_id = uuid();
  return out;
}

/**
 * Fill a form's matching hidden inputs from the attribution payload.
 * Only inputs that already exist in the markup are touched (Netlify needs the
 * fields present at build time). Returns the event_id used.
 */
export function fillAttribution(form: HTMLFormElement): string {
  const attr = collectAttribution();
  Object.keys(attr).forEach((name) => {
    const el = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (el) el.value = attr[name];
  });
  return attr.event_id;
}
