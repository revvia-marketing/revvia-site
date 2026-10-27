import { appendCheckoutParams, checkoutParams, clientReferenceId, messageMatchVisible, randomId } from '../lib/ai-visibility/ids.mjs';
import { prefillFromQuery } from '../lib/ai-visibility/validate.mjs';
import { createTurnstileSession, takeTurnstileToken } from '../lib/ai-visibility/turnstile-client.mjs';

const ASSISTANTS = ['chatgpt', 'perplexity', 'claude'];

function cfg() {
  const node = document.getElementById('aiv-config');
  if (!node) return null;
  try {
    return JSON.parse(node.textContent || '{}');
  } catch {
    return null;
  }
}

function firstTouch() {
  const params = new URLSearchParams(location.search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const incoming = {};
  let any = false;
  for (const key of keys) {
    const value = params.get(key);
    if (value) {
      incoming[key] = value;
      any = true;
    }
  }
  let stored = {};
  try {
    stored = JSON.parse(sessionStorage.getItem('aiv_ft') || '{}') || {};
  } catch {
    stored = {};
  }
  if (!any) {
    for (const key of keys) {
      if (!stored[key]) {
        const existing = sessionStorage.getItem(`rv_${key}`);
        if (existing) stored[key] = existing;
      }
    }
  }
  const frozen = any ? { ...stored, ...incoming } : stored;
  if (any || Object.keys(frozen).length) sessionStorage.setItem('aiv_ft', JSON.stringify(frozen));
  return frozen;
}

function visitId() {
  let id = sessionStorage.getItem('aiv_visit');
  if (!id) {
    id = randomId(12);
    sessionStorage.setItem('aiv_visit', id);
  }
  return id;
}

function track(name, params) {
  const key = `aiv_ev_${name}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
}

function namedBucket(n) {
  if (n <= 0) return '0';
  if (n <= 2) return '1-2';
  if (n <= 5) return '3-5';
  return '6-8';
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function fill(template, values) {
  return String(template || '').replace(/\{([^}]+)\}/g, (all, key) => {
    if (values[key] == null) return all;
    if (values[`raw:${key}`]) return String(values[key]);
    return esc(values[key]);
  });
}

function zone() {
  const date = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  const dateText = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date);
  return { date: dateText, time, timezone };
}

function setErrors(form, messages) {
  const box = form.querySelector('.aiv-errors');
  if (!box) return;
  box.replaceChildren();
  for (const message of messages) {
    const p = document.createElement('p');
    p.textContent = message;
    box.appendChild(p);
  }
}

function wireCheckout(config) {
  const touch = firstTouch();
  document.querySelectorAll('[data-checkout]').forEach((link) => {
    link.addEventListener('click', () => {
      const plan = link.getAttribute('data-checkout');
      const checkId = sessionStorage.getItem('aiv_check') || '';
      const email = sessionStorage.getItem('aiv_email') || '';
      const ref = clientReferenceId({
        checkId,
        visitId: visitId(),
        source: touch.utm_source || '',
        campaign: touch.utm_campaign || '',
      });
      const params = checkoutParams({
        utm: touch,
        clientReferenceId: ref,
        email,
      });
      const next = appendCheckoutParams(link.getAttribute('data-base') || link.getAttribute('href'), params);
      link.setAttribute('href', next);
      track(plan === 'grow' ? 'checkout_click_grow' : 'checkout_click_keep', { has_check: Boolean(checkId) });
    });
  });
}

function wireSticky() {
  const bar = document.getElementById('aiv-sticky');
  const hero = document.getElementById('check');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  const zones = ['check', 'pricing', 'final-cta'].map((id) => document.getElementById(id)).filter(Boolean);
  const seen = new Map();
  const paint = () => {
    const narrow = window.matchMedia('(max-width: 768px)').matches;
    const heroGone = seen.get('hero') === false;
    const blocked = zones.some((node) => seen.get(node.id) === true);
    bar.hidden = !(narrow && heroGone && !blocked);
  };
  const watch = new IntersectionObserver((entries) => {
    for (const entry of entries) seen.set(entry.target === hero ? 'hero' : entry.target.id, entry.isIntersecting);
    paint();
  }, { threshold: 0.05 });
  watch.observe(hero);
  zones.forEach((node) => watch.observe(node));
  window.addEventListener('resize', paint);
  bar.querySelector('a')?.addEventListener('click', (event) => {
    event.preventDefault();
    hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const empty = [...hero.querySelectorAll('input, select')].find((field) => !field.value && field.type !== 'hidden' && field.type !== 'checkbox');
    empty?.focus();
  });
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !bar || bar.hidden) return;
    const rect = target.getBoundingClientRect();
    const barTop = bar.getBoundingClientRect().top;
    if (rect.bottom > barTop - 8) window.scrollBy({ top: rect.bottom - barTop + 16 });
  });
}

function wireQuotes() {
  document.querySelectorAll('.aiv-rcard').forEach((card) => {
    const quote = card.querySelector('.aiv-quote');
    const button = card.querySelector('.aiv-more');
    if (!quote || !button) return;
    const clipped = quote.scrollHeight > quote.clientHeight + 2;
    if (!clipped) {
      button.hidden = true;
      return;
    }
    button.addEventListener('click', () => {
      const open = quote.classList.toggle('is-open');
      button.textContent = open ? 'Show less' : 'Read more';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
}

function wireFounding() {
  const box = document.getElementById('aiv-founding');
  if (!box) return;
  fetch('/api/founding')
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.ok) return;
      if (data.left === 0) {
        box.hidden = true;
        return;
      }
      const line = box.querySelector('[data-founding-line]');
      if (line && data.left >= 1 && data.left <= 10) {
        line.textContent = `${data.left} of 10 founding spots left.`;
      }
    })
    .catch(() => {});
}

function plain(template, values) {
  return String(template || '').replace(/\{([^}]+)\}/g, (all, key) => (values[key] == null ? all : String(values[key])));
}

function labelOf(name) {
  return name[0].toUpperCase() + name.slice(1);
}

function progressHtml(strings, values) {
  const items = ASSISTANTS.map((name) => `<li data-assistant="${name}">${fill(strings.asking, { assistant: labelOf(name) })}</li>`).join('');
  return `<div class="aiv-progress"><h3>${fill(strings.runningHeading, values)}</h3><ul class="aiv-status">${items}</ul><p class="aiv-honesty">${esc(strings.runningNote)}</p></div>`;
}

function resultHtml(strings, result, values) {
  const counts = result.byAssistant || {};
  const failed = ASSISTANTS.filter((name) => counts[name] && counts[name].status === 'error');
  const ok = ASSISTANTS.filter((name) => !failed.includes(name));
  const lines = ASSISTANTS.map((name) => {
    const row = counts[name] || {};
    const label = labelOf(name);
    const text = row.status === 'error' || row.named == null ? strings.notAvailable : `${row.named} of 8`;
    return `<li>${esc(label)}: ${esc(text)}</li>`;
  }).join('');
  const named = Number(result.namedCount) || 0;
  const headline = named === 0 ? strings.resultZero : named === 8 ? strings.resultEight : strings.resultHeadline;
  const partial = failed.length && ok.length
    ? `<p class="aiv-break">${fill(strings.assistantFailed, {
      Assistant: failed.map(labelOf).join(' and '),
      'the others': ok.map(labelOf).join(' and '),
    })}</p>`
    : '';
  const possible = result.possibleCount
    ? `<p class="aiv-break">${fill(strings.possible, { n: result.possibleCount })}</p>`
    : '';
  const hours = result.cached ? String(Math.max(0, Math.round(Number(result.cacheAgeHours) || 0))) : '';
  const cachedNote = result.cached ? fill(strings.cachedNote, { ...values, hours }) : '';
  const honesty = fill(strings.honesty, { ...values, cachedNote, 'raw:cachedNote': true });
  const under = named > 0 ? `<p class="aiv-break">${fill(strings.resultUnder, { X: named })}</p>` : '';
  return `<div class="aiv-result"><h3>${fill(headline, { ...values, X: named })}</h3><ul class="aiv-status">${lines}</ul>${under}${partial}${possible}<p class="aiv-honesty">${honesty} <a href="/ai-visibility/methodology/">${esc(strings.honestyLink)}</a></p></div>`;
}

function showFallback(form, strings, kind) {
  delete form.dataset.checking;
  form.classList.remove('is-instant');
  const banner = form.querySelector('.aiv-banner');
  if (banner) {
    banner.hidden = false;
    banner.textContent = kind === 'limited' ? strings.rateLimited : strings.failed;
  }
  form.querySelectorAll('.aiv-step2 input, .aiv-step2 textarea').forEach((field) => {
    field.disabled = false;
    if (field.type !== 'checkbox') field.required = true;
  });
}

async function runCheck(form, config) {
  const strings = config.strings;
  const data = new FormData(form);
  const business = String(data.get('business') || '').trim();
  const city = String(data.get('city') || '').trim();
  const trade = String(data.get('trade') || '').trim();
  if (!business || !city || !trade) {
    setErrors(form, ['Add your business name, city, and trade.']);
    return;
  }
  if (form.dataset.checking === '1') return;
  form.dataset.checking = '1';
  const live = form.querySelector('.aiv-live');
  let token = '';
  try {
    token = await takeTurnstileToken(config.turnstile, {
      notify: (message) => setErrors(form, [message]),
    });
  } catch {
    delete form.dataset.checking;
    setErrors(form, ["We couldn't verify you're human. Please try again."]);
    return;
  }
  if (!token) {
    delete form.dataset.checking;
    setErrors(form, ["We couldn't verify you're human. Please try again."]);
    return;
  }
  setErrors(form, []);
  const values = { trade, city, Business: business, ...zone() };
  live.classList.add('is-reserved');
  live.innerHTML = progressHtml(strings, values);
  track('check_started', {});
  let start;
  try {
    const res = await fetch('/api/check/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        business,
        city,
        trade,
        website: String(data.get('website') || ''),
        noWebsite: data.get('no_website') === 'on',
        turnstileToken: token,
      }),
    });
    start = await res.json();
  } catch {
    showFallback(form, strings, 'failed');
    live.innerHTML = `<div class="aiv-progress"><p>${esc(strings.failed)}</p></div>`;
    delete form.dataset.checking;
    return;
  }
  if (!start.ok) {
    const kind = start.kind === 'limited' ? 'limited' : 'failed';
    showFallback(form, strings, kind);
    live.innerHTML = `<div class="aiv-progress"><p>${esc(kind === 'limited' ? strings.rateLimited : strings.failed)}</p></div>`;
    delete form.dataset.checking;
    return;
  }
  sessionStorage.setItem('aiv_check', start.checkId);
  const hidden = form.querySelector('[name="check_id"]');
  if (hidden) hidden.value = start.checkId;
  if (start.status === 'complete') {
    const status = await fetch(`/api/check/status?id=${encodeURIComponent(start.checkId)}`).then((res) => res.json());
    reveal(form, config, status, values);
    return;
  }
  const started = Date.now();
  const timer = setInterval(async () => {
    if (Date.now() - started > 90000) {
      clearInterval(timer);
      showFallback(form, strings, 'failed');
      live.innerHTML = `<div class="aiv-progress"><p>${esc(strings.failed)}</p></div>`;
      return;
    }
    let status;
    try {
      status = await fetch(`/api/check/status?id=${encodeURIComponent(start.checkId)}`).then((res) => res.json());
    } catch {
      return;
    }
    const progress = status.progress || {};
    for (const name of ASSISTANTS) {
      const row = form.querySelector(`[data-assistant="${name}"]`);
      const state = progress[name];
      if (!row || !state) continue;
      const assistant = labelOf(name);
      row.textContent = plain(state === 'done' || state === 'error' ? strings.done : strings.asking, { assistant });
    }
    if (status.status === 'complete' || status.status === 'failed') {
      clearInterval(timer);
      reveal(form, config, status, values);
    }
  }, 1500);
}

function reveal(form, config, status, values) {
  delete form.dataset.checking;
  const live = form.querySelector('.aiv-live');
  if (!status || status.status === 'failed' || !status.result) {
    showFallback(form, config.strings, 'failed');
    live.innerHTML = `<div class="aiv-progress"><p>${esc(config.strings.failed)}</p></div>`;
    return;
  }
  live.innerHTML = resultHtml(config.strings, status.result, values);
  form.classList.add('is-result');
  form.querySelectorAll('.aiv-step2 input, .aiv-step2 textarea').forEach((field) => {
    field.disabled = false;
    if (field.type !== 'checkbox') field.required = true;
  });
  const counts = status.result.byAssistant || {};
  const set = (name, value) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.value = value;
  };
  set('named_count', String(status.result.namedCount));
  set('check_mode', 'instant');
  for (const name of ASSISTANTS) {
    const row = counts[name];
    set(`${name}_count`, row && row.status === 'error' ? 'not-available' : String(row?.named ?? 'not-available'));
  }
  const ok = ASSISTANTS.filter((name) => counts[name] && counts[name].status === 'ok').length;
  track('check_result_shown', {
    named_bucket: namedBucket(status.result.namedCount),
    assistants_ok: ok,
    cached: Boolean(status.result.cached),
  });
}

function postNetlify(form) {
  const data = new FormData(form);
  const touch = firstTouch();
  for (const [key, value] of Object.entries(touch)) {
    if (value) data.set(key, value);
  }
  data.set('form-name', 'ai-visibility-check');
  return fetch('/ai-visibility/thanks/', { method: 'POST', body: data });
}

export function initAiVisibility() {
  const config = cfg();
  const form = document.getElementById('aiv-form');
  if (!config || !form) return;
  const touch = firstTouch();
  visitId();
  const match = document.getElementById('aiv-match');
  if (match) match.hidden = !messageMatchVisible(touch);

  const query = Object.fromEntries(new URLSearchParams(location.search));
  const filled = prefillFromQuery(query);
  if (filled.business) form.business.value = filled.business;
  if (filled.city) form.city.value = filled.city;
  if (filled.trade) form.trade.value = filled.trade;

  const noSite = form.querySelector('[name="no_website"]');
  const website = form.querySelector('[name="website"]');
  noSite?.addEventListener('change', () => {
    if (!website) return;
    website.disabled = noSite.checked;
    if (noSite.checked) website.value = '';
  });

  if (config.mode === 'instant') {
    form.querySelectorAll('.aiv-step2 input, .aiv-step2 textarea').forEach((field) => {
      field.required = false;
      field.disabled = true;
    });
    config.turnstile = createTurnstileSession({
      getApi: () => window.turnstile,
      mount: form.querySelector('.aiv-turnstile'),
      sitekey: config.turnstileSiteKey,
    });
    config.turnstile.ensureScript(document);
  }

  form.addEventListener('submit', async (event) => {
    if (form.querySelector('[name="bot-field"]')?.value) {
      event.preventDefault();
      return;
    }
    if (form.classList.contains('is-instant') && !form.classList.contains('is-result')) {
      event.preventDefault();
      await runCheck(form, config);
      return;
    }
    event.preventDefault();
    const email = String(new FormData(form).get('email') || '').trim();
    if (email) sessionStorage.setItem('aiv_email', email);
    if (!form.querySelector('[name="check_mode"]').value) form.querySelector('[name="check_mode"]').value = 'fallback';
    try {
      await postNetlify(form);
    } catch {
      setErrors(form, ['Something went wrong sending that. Please try again.']);
      return;
    }
    const eventId = form.querySelector('[name="event_id"]')?.value || randomId(16);
    const payload = new FormData(form);
    if (window.rvTrack && typeof window.rvTrack.lead === 'function') {
      window.rvTrack.lead('ai-visibility-audit', eventId, payload);
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { currency: 'USD', value: 1, form_name: 'ai-visibility-audit' });
    }
    track('email_submitted', {});
    window.location.href = '/ai-visibility/thanks/';
  });

  wireCheckout(config);
  wireSticky();
  wireQuotes();
  wireFounding();
}
