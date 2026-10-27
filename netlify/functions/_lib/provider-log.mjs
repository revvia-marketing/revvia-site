/** Safe provider-failure lines. Never include keys, prompts, or email addresses. */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const KEY = /\b(?:sk|rk|pk|pplx|bearer)[-_\s]?[A-Za-z0-9._-]{8,}\b/gi;

export function redactLogText(value, question) {
  let text = String(value ?? '');
  const prompt = String(question || '');
  if (prompt.length >= 12) text = text.split(prompt).join('[redacted-prompt]');
  return text.replace(EMAIL, '[redacted-email]').replace(KEY, '[redacted-key]');
}

function errorBody(err) {
  const body = err?.body;
  if (body == null) return '';
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

export function safeProviderFailure({ provider, model, question, err }) {
  const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
  const status = Number.isFinite(err?.status) ? err.status : null;
  const type = timedOut ? 'timeout' : err?.body?.error?.type || err?.name || 'error';
  const message = redactLogText(err?.body?.error?.message || err?.message || '', question).slice(0, 500);
  const body = redactLogText(errorBody(err), question).slice(0, 500);
  return {
    provider: provider || '',
    model: model || '',
    status,
    error: type,
    message,
    body,
  };
}
