import { json, clientIp } from './_lib/http.mjs';
import { openCheckStore } from './_lib/store.mjs';
import { acceptCheck } from './_lib/engine.mjs';
import { askAssistant } from './_lib/assistants.mjs';
import { loadQuestionBank } from './_lib/bank.mjs';
import { missingCheckEnv } from '../../src/lib/ai-visibility/env.mjs';
import { validateCheckInput } from '../../src/lib/ai-visibility/validate.mjs';
import { verifyTurnstileToken } from './_lib/turnstile.mjs';

export const config = { path: '/api/check/start' };

export default async (req) => {
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
      const origin = new URL(req.url).origin;
      const run = fetch(`${origin}/.netlify/functions/check-run-background`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ checkId: accepted.checkId }),
      }).catch((err) => {
        console.error('[check] background invoke failed', err?.name || 'error');
      });
      // Don't wait for the 24 calls. The background route returns as soon as
      // the platform accepts the job. A short race is covered by status polling.
      await Promise.race([run, new Promise((resolve) => setTimeout(resolve, 1500))]);
    }

    return json({ ok: true, checkId: accepted.checkId, status: accepted.status, cached: Boolean(accepted.cached) });
  } catch (err) {
    console.error('[check] start failed', err?.name || 'error');
    return json({ ok: false, kind: 'failed' });
  }
};
