/** Build-time and runtime gate for the instant check. No secret values are returned. */

export const REQUIRED_CHECK_ENV = [
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'PERPLEXITY_API_KEY',
  'PERPLEXITY_MODEL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'PUBLIC_TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'CHECK_IP_SALT',
];

export function missingCheckEnv(env = process.env) {
  const missing = [];
  if (env.CHECK_ENABLED !== 'true') missing.push('CHECK_ENABLED');
  for (const key of REQUIRED_CHECK_ENV) {
    if (!String(env[key] || '').trim()) missing.push(key);
  }
  return missing;
}

export function instantCheckEnabled(env = process.env) {
  return missingCheckEnv(env).length === 0;
}

/** Deploy previews and local builds show unverified reviews. Production hides them. */
export function showUnverifiedReviews(env = process.env) {
  return env.CONTEXT !== 'production';
}

export const STRIPE_KEEP_DEFAULT = 'https://buy.stripe.com/5kQ4gzcOH2ri4yP8WQ0kE0M';
export const STRIPE_GROW_DEFAULT = 'https://buy.stripe.com/8x2bJ17un3vm2qHeha0kE0N';

export function stripeHref(envKey, env = process.env) {
  if (envKey === 'PUBLIC_STRIPE_LINK_KEEP') return env.PUBLIC_STRIPE_LINK_KEEP || STRIPE_KEEP_DEFAULT;
  if (envKey === 'PUBLIC_STRIPE_LINK_GROW') return env.PUBLIC_STRIPE_LINK_GROW || STRIPE_GROW_DEFAULT;
  return '';
}
