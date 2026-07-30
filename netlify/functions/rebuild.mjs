// netlify/functions/rebuild.mjs
// Daily scheduled rebuild. The Journal gates posts by publish date at build
// time (src/lib/journal.ts), so a future-dated post only goes live once the
// site is rebuilt on/after its date. This triggers that rebuild once a day by
// pinging a Netlify build hook stored in the BUILD_HOOK_URL env var.
//
// Setup (one time): Netlify -> Site configuration -> Build & deploy ->
// Build hooks -> Add build hook, then save its URL as BUILD_HOOK_URL.

export const config = { schedule: "0 13 * * *" }; // ~06:00 America/Los_Angeles

export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) {
    return new Response("BUILD_HOOK_URL not set; skipping scheduled rebuild.", { status: 200 });
  }
  try {
    await fetch(hook, { method: "POST" });
    return new Response("Scheduled rebuild triggered.", { status: 200 });
  } catch (err) {
    return new Response("Failed to trigger rebuild: " + (err?.message || err), { status: 500 });
  }
};
