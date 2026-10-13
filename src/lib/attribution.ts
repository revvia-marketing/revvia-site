/**
 * Client-side ad attribution (section 2c). Imported by every landing page form.
 *
 * On load, `initAttribution()` captures ad click ids + UTMs from the URL into
 * sessionStorage (rv_ prefix) and seeds the Meta `_fbc` cookie from `fbclid`.
 * On submit, `fillAttribution(form)` writes the captured values (plus the
 * `_fbc`/`_fbp` cookies, a query-string-free landing_url, and a fresh event_id)
 * into whatever matching hidden inputs the form has, and returns the event_id.
 * Every storage/cookie read and write is wrapped in try/catch.
 */

const PREFIX = 'rv_';
const PARAMS = [
  'fbclid',
  'gclid',
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

/** Run once per landing-page load (from LandingLayout). */
export function initAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    PARAMS.forEach((k) => {
      const v = params.get(k);
      if (v) ssSet(k, v);
    });
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
    out[k] = ssGet(k) || (urlParams ? urlParams.get(k) || '' : '');
  });
  out.fbc = getCookie('_fbc');
  out.fbp = getCookie('_fbp');
  // landing_url deliberately excludes the query string (no PII/click-ids in it).
  out.landing_url = window.location.origin + window.location.pathname;
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
