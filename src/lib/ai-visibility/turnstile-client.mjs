/** Browser-side Turnstile token handling. Explicit render does not leave a reliable hidden input. */

export const TURNSTILE_WAITING = "One moment, verifying you're human";
export const TURNSTILE_API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function createTurnstileSession({ getApi, mount, sitekey }) {
  let widgetId;
  let token = '';
  let rendered = false;
  const waiters = new Set();

  function render() {
    const turnstile = getApi?.();
    if (!sitekey || !mount || !turnstile || rendered) return widgetId;
    rendered = true;
    widgetId = turnstile.render(mount, {
      sitekey,
      callback(value) {
        token = String(value || '');
        for (const waiter of waiters) waiter(token);
        waiters.clear();
      },
      'expired-callback'() {
        token = '';
      },
      'error-callback'() {
        token = '';
      },
    });
    return widgetId;
  }

  function read() {
    const turnstile = getApi?.();
    let fallback = '';
    if (widgetId != null && turnstile && typeof turnstile.getResponse === 'function') {
      fallback = String(turnstile.getResponse(widgetId) || '');
    }
    return token || fallback;
  }

  function ensureScript(doc) {
    if (!sitekey || !mount) return;
    if (getApi?.()) {
      render();
      return;
    }
    if (doc.querySelector('script[data-turnstile-api]')) return;
    const script = doc.createElement('script');
    script.src = TURNSTILE_API;
    script.async = true;
    script.dataset.turnstileApi = '1';
    script.onload = () => render();
    doc.head.appendChild(script);
  }

  function reset() {
    token = '';
    const turnstile = getApi?.();
    if (widgetId != null && turnstile && typeof turnstile.reset === 'function') {
      turnstile.reset(widgetId);
    }
  }

  function waitForToken({ timeoutMs = 5000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    const existing = read();
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        waiters.delete(onToken);
        resolve(value || read());
      };
      const timer = setTimer(() => finish(read()), timeoutMs);
      function onToken(value) {
        clearTimer(timer);
        finish(value);
      }
      waiters.add(onToken);
    });
  }

  return { render, ensureScript, reset, read, waitForToken };
}

/** Copy a single-use token, then reset the widget. Empty means the caller must not post. */
export async function takeTurnstileToken(session, { notify, timeoutMs, setTimer, clearTimer } = {}) {
  const ready = session.read();
  if (ready) {
    session.reset();
    return ready;
  }
  if (notify) notify(TURNSTILE_WAITING);
  const token = await session.waitForToken({ timeoutMs, setTimer, clearTimer });
  if (token) session.reset();
  return token;
}
