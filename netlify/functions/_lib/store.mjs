import { getStore } from '@netlify/blobs';

/**
 * Netlify Blobs when the site can reach them. Null when the store is missing.
 * No health read: that extra strong-consistency round trip sat on every
 * check-start, including cache hits, before any real work began.
 */
export async function openBlobStore(name) {
  try {
    const store = getStore({ name, consistency: 'strong' });
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
    console.error('[blobs] unavailable', err?.name || 'error');
    return null;
  }
}

export async function openCheckStore() {
  return openBlobStore('ai-visibility-checks');
}
