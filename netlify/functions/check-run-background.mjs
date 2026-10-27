import { executeJob } from './_lib/engine.mjs';
import { openCheckStore } from './_lib/store.mjs';
import { askAssistant } from './_lib/assistants.mjs';
import { loadQuestionBank } from './_lib/bank.mjs';

/**
 * Background Function (the -background suffix). Netlify returns 202 immediately
 * and lets this run up to 15 minutes, which covers 24 parallel assistant calls
 * without depending on the synchronous function timeout.
 */
export default async (req) => {
  if (req.method !== 'POST') return new Response('', { status: 204 });
  let checkId = '';
  try {
    checkId = (await req.json())?.checkId || '';
  } catch {
    return new Response('', { status: 204 });
  }
  const store = await openCheckStore();
  if (!store || !checkId) {
    console.error('[check] background missing store or id');
    return new Response('', { status: 204 });
  }
  try {
    const started = Date.now();
    const report = await executeJob({
      store,
      env: process.env,
      checkId,
      bank: loadQuestionBank(),
      ask: (call) => askAssistant({ ...call, env: process.env }),
    });
    for (const failure of report?.failures || []) {
      console.error('[check] provider failed', failure);
    }
    console.error('[check] run summary', { checkId, ...(report?.summary || {}), durationMs: Date.now() - started });
  } catch (err) {
    console.error('[check] background failed', err?.name || 'error');
    const job = await store.get(`job:${checkId}`);
    if (job && job.status === 'running') {
      await store.set(`job:${checkId}`, { ...job, status: 'failed', result: null });
    }
  }
  return new Response('', { status: 202 });
};
