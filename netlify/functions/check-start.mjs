import { json, clientIp } from './_lib/http.mjs';
import { openCheckStore } from './_lib/store.mjs';
import { acceptCheck } from './_lib/engine.mjs';
import { askAssistant } from './_lib/assistants.mjs';
import { loadQuestionBank } from './_lib/bank.mjs';
import { missingCheckEnv } from '../../src/lib/ai-visibility/env.mjs';
import { validateCheckInput } from '../../src/lib/ai-visibility/validate.mjs';
import { verifyTurnstileToken } from './_lib/turnstile.mjs';

export const config = { path: '/api/check/start' };

function invokeBackground(req, checkId) {
  const origin = new URL(req.url).origin;
  return fetch(`${origin}/.netlify/functions/check-run-background`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ checkId }),
  }).catch((err) => {
    console.error('[check] background invoke failed', err?.name || 'error');
  });
}

export default async (req, context) => {
  if (req.method !== 'POST') return json({ ok: false, kind: 'disabled' }, 405);

  const missing = missingCheckEnv();
  if (missing.length) {
    console.error('[check] disabled', missing.join(','));
    return json({ ok: false, kind: 'disabled' });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, kind: 'invalid' }, 400);
  }

  const bank = loadQuestionBank();
  const parsed = validateCheckInput(body, bank.map((entry) => entry.trade));
  if (!parsed.ok) return json({ ok: false, kind: 'invalid', fields: parsed.fields }, 400);

  const ip = clientIp(req);
  const human = await verifyTurnstileToken(body.turnstileToken, ip, {
    secret: process.env.TURNSTILE_SECRET_KEY,
  });
  if (!human) return json({ ok: false, kind: 'failed' });

  const store = await openCheckStore();
  if (!store) return json({ ok: false, kind: 'disabled' });

  try {
    const accepted = await acceptCheck({
      store,
      env: process.env,
      input: parsed.value,
      ip,
      bank,
    });
    if (!accepted.ok) return json({ ok: false, kind: accepted.kind, fields: accepted.fields });

    if (accepted.status === 'running') {
      // Don't await the background run. If the platform doesn't answer 202
      // until that function finishes, awaiting it holds this response for the
      // whole check (minutes), including when the run only reads cache.
      const pending = invokeBackground(req, accepted.checkId);
      if (context && typeof context.waitUntil === 'function') context.waitUntil(pending);
      else await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, 1500))]);
    }

    return json({
      ok: true,
      checkId: accepted.checkId,
      status: accepted.status,
      cached: Boolean(accepted.cached),
      result: accepted.result || null,
    });
  } catch (err) {
    console.error('[check] start failed', err?.name || 'error');
    return json({ ok: false, kind: 'failed' });
  }
};
