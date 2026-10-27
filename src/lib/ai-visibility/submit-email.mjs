/**
 * Finish the free-check email step. The form post must succeed.
 * Analytics run after that and cannot block or throw past the redirect.
 */
export async function completeEmailSubmit({ post, onAnalytics, redirect }) {
  let posted = false;
  try {
    const res = await post();
    posted = Boolean(res && res.ok !== false);
  } catch {
    return { ok: false };
  }
  if (!posted) return { ok: false };
  try {
    onAnalytics?.();
  } catch {
    /* analytics must never block the redirect */
  }
  try {
    redirect?.();
  } catch {
    /* caller still redirects */
  }
  return { ok: true };
}
