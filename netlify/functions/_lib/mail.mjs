/**
 * Plain-text SendGrid mail for AI Visibility.
 * From Tim Holt <tim@revvia.com>, reply-to tim@revvia.com.
 * Required env: SENDGRID_API_KEY (already used by submission-created).
 */

export const TIM_EMAIL = 'tim@revvia.com';
export const TIM_NAME = 'Tim Holt';

export function signOff(body) {
  const trimmed = String(body || '').replace(/\s+$/, '');
  return `${trimmed}\n\nThanks,\nTim\n`;
}

export async function sendPlain({ to, subject, text, env = process.env, fetchImpl = fetch }) {
  const key = env.SENDGRID_API_KEY;
  if (!key) {
    console.warn('[mail] SENDGRID_API_KEY not set');
    return { ok: false, skipped: true };
  }
  const email = String(to || '').trim();
  if (!email) return { ok: false };
  try {
    const res = await fetchImpl('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: TIM_EMAIL, name: TIM_NAME },
        reply_to: { email: TIM_EMAIL, name: TIM_NAME },
        subject: String(subject || ''),
        content: [{ type: 'text/plain', value: String(text || '') }],
      }),
    });
    if (!res.ok) {
      console.error('[mail] send failed', res.status);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[mail] send failed', err?.name || 'error');
    return { ok: false };
  }
}
