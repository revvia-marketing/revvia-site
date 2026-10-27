import { json } from './_lib/http.mjs';
import { openCheckStore } from './_lib/store.mjs';
import { readStatus } from './_lib/engine.mjs';
import { missingCheckEnv } from '../../src/lib/ai-visibility/env.mjs';

export const config = { path: '/api/check/status' };

export default async (req) => {
  if (req.method !== 'GET') return json({ ok: false, kind: 'disabled' }, 405);
  if (missingCheckEnv().length) return json({ ok: false, kind: 'disabled' });
  const store = await openCheckStore();
  if (!store) return json({ ok: false, kind: 'disabled' });
  const id = new URL(req.url).searchParams.get('id') || '';
  try {
    const status = await readStatus(store, id);
    if (!status) return json({ ok: false, kind: 'failed' }, 404);
    return json(status);
  } catch (err) {
    console.error('[check] status failed', err?.name || 'error');
    return json({ ok: false, kind: 'failed' });
  }
};
