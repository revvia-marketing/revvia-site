/**
 * Hosts Cloudflare's Turnstile CSP reference and widget docs require.
 * `data:` is intentionally absent: those docs do not list it for connect-src,
 * and a site policy cannot override the challenge frame's own CSP.
 */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export function turnstileContentSecurityPolicy() {
  const script = ["'self'", "'unsafe-inline'", 'https:', TURNSTILE_ORIGIN];
  const frame = ["'self'", 'https:', TURNSTILE_ORIGIN];
  const connect = ["'self'", 'https:', TURNSTILE_ORIGIN];
  return `script-src ${script.join(' ')}; frame-src ${frame.join(' ')}; connect-src ${connect.join(' ')}`;
}
