import { getStore } from '@netlify/blobs';

/** Netlify Blobs when the site can reach them. Null when the store is missing. */
export async function openCheckStore() {
  try {
    const store = getStore({ name: 'ai-visibility-checks', consistency: 'strong' });
    await store.get('__health', { type: 'text' });
    return {
      async get(key) {
        return store.get(key, { type: 'json' });
      },
      async set(key, value) {
        await store.setJSON(key, value);
      },
      async del(key) {
        await store.delete(key);
      },
    };
  } catch (err) {
    console.error('[check] store unavailable', err?.name || 'error');
    return null;
  }
}
