import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TURNSTILE_WAITING,
  createTurnstileSession,
  takeTurnstileToken,
} from './turnstile-client.mjs';
import { TURNSTILE_ORIGIN, turnstileContentSecurityPolicy } from './turnstile-csp.mjs';

function fakeDocument() {
  const scripts = [];
  return {
    scripts,
    createElement() {
      return { dataset: {}, async: false, onload: null, src: '' };
    },
    head: {
      appendChild(node) {
        scripts.push(node);
      },
    },
    querySelector(sel) {
      if (sel !== 'script[data-turnstile-api]') return null;
      return scripts.find((node) => node.dataset.turnstileApi) || null;
    },
  };
}

function harness(response = '') {
  let options;
  const turnstile = {
    render(mount, opts) {
      options = opts;
      return 'widget-1';
    },
    getResponse(id) {
      assert.equal(id, 'widget-1');
      return response;
    },
    reset(id) {
      assert.equal(id, 'widget-1');
      turnstile.resetCount = (turnstile.resetCount || 0) + 1;
    },
  };
  const session = createTurnstileSession({
    getApi: () => turnstile,
    mount: {},
    sitekey: 'site-key',
  });
  return { session, turnstile, options: () => options };
}

describe('turnstile client', () => {
  it('renders on demand and keeps the callback token', async () => {
    const { session, options } = harness();
    const doc = fakeDocument();
    session.ensureScript(doc);
    assert.equal(doc.scripts.length, 0);
    assert.equal(options().sitekey, 'site-key');
    assert.equal(typeof options().callback, 'function');
    assert.equal(typeof options()['expired-callback'], 'function');
    assert.equal(typeof options()['error-callback'], 'function');

    options().callback('token-a');
    const notices = [];
    const token = await takeTurnstileToken(session, { notify: (message) => notices.push(message) });
    assert.equal(token, 'token-a');
    assert.deepEqual(notices, []);
    assert.equal(session.read(), '');
  });

  it('falls back to getResponse and resets after a token is taken', async () => {
    const { session, turnstile } = harness('from-widget');
    session.render();
    const token = await takeTurnstileToken(session, { notify() {} });
    assert.equal(token, 'from-widget');
    assert.equal(turnstile.resetCount, 1);
  });

  it('waits for the callback instead of returning an empty token', async () => {
    const { session, options, turnstile } = harness();
    session.render();
    const notices = [];
    let scheduled = null;
    const pending = takeTurnstileToken(session, {
      notify: (message) => notices.push(message),
      timeoutMs: 5000,
      setTimer(fn) {
        scheduled = fn;
        return 1;
      },
      clearTimer() {
        scheduled = null;
      },
    });
    assert.deepEqual(notices, [TURNSTILE_WAITING]);
    options().callback('late-token');
    assert.equal(await pending, 'late-token');
    assert.equal(scheduled, null);
    assert.equal(turnstile.resetCount, 1);
  });

  it('does not post when the wait expires with no token', async () => {
    const { session, turnstile } = harness('');
    session.render();
    let scheduled = null;
    const pending = takeTurnstileToken(session, {
      notify() {},
      timeoutMs: 5000,
      setTimer(fn) {
        scheduled = fn;
        return 1;
      },
      clearTimer() {},
    });
    scheduled();
    const token = await pending;
    assert.equal(token, '');
    assert.equal(turnstile.resetCount, undefined);
  });

  it('loads the api script once and renders when it arrives', () => {
    let api = null;
    let options;
    const turnstile = {
      render(_mount, opts) {
        options = opts;
        return 'widget-2';
      },
    };
    const session = createTurnstileSession({
      getApi: () => api,
      mount: {},
      sitekey: 'site-key',
    });
    const doc = fakeDocument();
    session.ensureScript(doc);
    session.ensureScript(doc);
    assert.equal(doc.scripts.length, 1);
    assert.equal(doc.scripts[0].src.includes('challenges.cloudflare.com/turnstile/v0/api.js'), true);
    api = turnstile;
    doc.scripts[0].onload();
    assert.equal(typeof options.callback, 'function');
    options['expired-callback']();
    options.callback('fresh');
    options['error-callback']();
    assert.equal(session.read(), '');
  });

  it('renders the widget from page load, not from a focus listener', () => {
    const src = readFileSync(new URL('../../scripts/ai-visibility.js', import.meta.url), 'utf8');
    assert.match(src, /ensureScript\(document\)/);
    assert.doesNotMatch(src, /cf-turnstile-response/);
    assert.doesNotMatch(src, /focusin', arm/);
  });
});

describe('turnstile content security policy', () => {
  it('allows the documented Turnstile origin and does not add data:', () => {
    const policy = turnstileContentSecurityPolicy();
    for (const directive of ['script-src', 'frame-src', 'connect-src']) {
      const part = policy.split(';').find((item) => item.trim().startsWith(directive));
      assert.ok(part, directive);
      assert.match(part, new RegExp(TURNSTILE_ORIGIN.replace(/[.]/g, '\\.')));
    }
    const connect = policy.split(';').find((item) => item.trim().startsWith('connect-src'));
    assert.doesNotMatch(connect, /\bdata:/);
    const toml = readFileSync(new URL('../../../netlify.toml', import.meta.url), 'utf8');
    const lines = toml.split('\n').filter((line) => line.includes('Content-Security-Policy'));
    assert.equal(lines.length, 2);
    for (const line of lines) assert.match(line, new RegExp(policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});
