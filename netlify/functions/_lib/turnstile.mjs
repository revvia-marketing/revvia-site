/** Reasons safe to log. Never include the token or the secret. */

export function missingTurnstileReason(secret, token) {
  const missing = [];
  if (!String(token ?? '').trim()) missing.push('missing token');
  if (!String(secret ?? '').trim()) missing.push('missing secret');
  if (missing.length === 0) return null;
  if (missing.length === 1) return missing[0];
  return missing;
}

export function siteverifyReason(payload) {
  if (payload && payload.success) return null;
  const codes = payload && payload['error-codes'];
  return Array.isArray(codes) ? codes : [];
}

export async function verifyTurnstileToken(token, ip, { secret, fetchImpl = fetch, log = console.error } = {}) {
  const missing = missingTurnstileReason(secret, token);
  if (missing) {
    log('[check] turnstile rejected', missing);
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    const reason = siteverifyReason(data);
    if (!reason) return true;
    log('[check] turnstile rejected', reason);
    return false;
  } catch (err) {
    log('[check] turnstile verify failed', err?.name || 'error');
    return false;
  }
}
