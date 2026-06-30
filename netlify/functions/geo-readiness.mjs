// netlify/functions/geo-readiness.mjs
// Deterministic GEO *readiness* check. This does NOT query LLMs or measure
// citations - it inspects the signals a site controls (schema, llms.txt,
// bylines, crawler access). Honest label: "readiness", never "you're cited".
//
// Endpoint: POST /api/geo-readiness  { "domain": "example.com" }
//        or GET  /api/geo-readiness?domain=example.com

import dns from "node:dns/promises";

export const config = { path: "/api/geo-readiness" };

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 600_000;
const UA = "RevviaGEOReadinessBot/1.0 (+https://www.revvia.com/services/geo-visibility-overhaul)";

// Lightweight per-IP rate limit. In-memory, so it's per warm instance, not
// global - it blunts casual hammering/scripting of this endpoint. For
// distributed/production-grade limiting, ALSO enable Netlify's built-in rate
// limiting on this function in the dashboard (Site config -> Functions).
const RATE = { windowMs: 60_000, max: 8 };
const hits = new Map(); // ip -> number[] (timestamps within window)

function rateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  // bound memory if the map grows large
  if (hits.size > 5000) {
    for (const k of hits.keys()) { hits.delete(k); if (hits.size <= 4000) break; }
  }
  return recent.length > RATE.max;
}

function clientIp(req) {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    ""
  );
}

const AI_BOTS = ["gptbot", "claudebot", "anthropic-ai", "perplexitybot", "google-extended", "ccbot", "oai-searchbot"];

export default async (req) => {
  if (rateLimited(clientIp(req))) {
    return json({ error: "Too many checks from your network. Give it a minute and try again." }, 429);
  }

  let domain = new URL(req.url).searchParams.get("domain") || "";
  if (req.method === "POST") {
    try { domain = (await req.json())?.domain || domain; } catch { /* ignore */ }
  }

  const target = normalizeDomain(domain);
  if (!target.ok) return json({ error: target.error }, 400);

  const guard = await ssrfGuard(target.host);
  if (!guard.ok) return json({ error: guard.error }, 400);

  let home;
  try {
    home = await safeFetch(target.url);
  } catch (e) {
    return json({ error: `Couldn't reach ${target.host}. Check the domain and try again.` }, 200);
  }

  const html = home.body;
  const [robots, llms] = await Promise.allSettled([
    safeFetch(`${target.origin}/robots.txt`),
    safeFetch(`${target.origin}/llms.txt`),
  ]);

  const ld = extractJsonLd(html);
  const types = ldTypes(ld);

  const checks = [
    chk("title", "Page title", weight(8), /<title[^>]*>\s*\S/i.test(html)),
    chk("metaDescription", "Meta description", weight(8), /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/i.test(html)),
    chk("jsonld", "Structured data present", weight(14), ld.length > 0),
    chk("orgSchema", "Organization / LocalBusiness schema", weight(14), hasType(types, ["organization", "localbusiness"])),
    chk("faqSchema", "FAQPage schema", weight(12), hasType(types, ["faqpage"])),
    chk("authorSchema", "Author bylines + Person schema", weight(12), hasType(types, ["person"]) || /<meta[^>]+name=["']author["']/i.test(html) || /rel=["']author["']/i.test(html)),
    chk("llmsTxt", "llms.txt file", weight(12), settled(llms) && llms.value.ok && looksLikeText(llms.value.body)),
    chk("crawlerAccess", "AI crawlers allowed in robots.txt", weight(10), settled(robots) ? !blocksAiBots(robots.value.body) : true),
    chk("openGraph", "Open Graph tags", weight(5), /<meta[^>]+property=["']og:/i.test(html)),
    chk("h1", "Primary heading (H1)", weight(5), /<h1[\s>]/i.test(html)),
  ];

  const score = Math.round(checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0));
  const grade = score >= 80 ? "strong" : score >= 60 ? "moderate" : "weak";

  // Teaser: reveal three findings, lock the rest behind the call.
  const previewKeys = ["jsonld", "llmsTxt", "authorSchema"];
  const preview = checks.filter((c) => previewKeys.includes(c.key))
    .map((c) => ({ label: c.label, status: c.pass ? "pass" : "fail" }));
  const locked = checks.filter((c) => !previewKeys.includes(c.key) && !c.pass)
    .map((c) => ({ label: c.label }));

  return json({
    domain: target.host,
    score,
    grade,
    preview,
    locked,
    lockedCount: locked.length,
    measures: "readiness", // not citation
  }, 200);
};

/* ---------- helpers ---------- */

function weight(n) { return n; }
function chk(key, label, weight, pass) { return { key, label, weight, pass: !!pass }; }
function settled(r) { return r.status === "fulfilled" && r.value; }

function normalizeDomain(raw) {
  let d = (raw || "").trim();
  if (!d) return { ok: false, error: "Enter a domain." };
  if (!/^https?:\/\//i.test(d)) d = "https://" + d;
  let u;
  try { u = new URL(d); } catch { return { ok: false, error: "That doesn't look like a valid domain." }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, error: "Only http and https are supported." };
  if (!u.hostname.includes(".")) return { ok: false, error: "Enter a full domain, like example.com." };
  return { ok: true, url: u.origin + "/", origin: u.origin, host: u.hostname };
}

async function ssrfGuard(host) {
  if (/^(localhost|0\.0\.0\.0)$/i.test(host) || host.endsWith(".local")) {
    return { ok: false, error: "That host isn't allowed." };
  }
  try {
    const { address } = await dns.lookup(host);
    if (isPrivateIp(address)) return { ok: false, error: "That host isn't allowed." };
  } catch {
    return { ok: false, error: `Couldn't resolve ${host}.` };
  }
  return { ok: true };
}

function isPrivateIp(ip) {
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some(isNaN)) return false;
  const [a, b] = p;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;       // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

async function safeFetch(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,text/plain,*/*" },
    });
    const reader = res.body?.getReader?.();
    let body = "";
    if (reader) {
      const dec = new TextDecoder();
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        body += dec.decode(value, { stream: true });
        if (bytes > MAX_BYTES) { try { await reader.cancel(); } catch {} break; }
      }
    } else {
      body = (await res.text()).slice(0, MAX_BYTES);
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

function looksLikeText(body) {
  const t = (body || "").trim();
  return t.length > 0 && !t.startsWith("<");
}

function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1].trim())); } catch { /* skip malformed */ }
  }
  return out;
}

function ldTypes(ld) {
  const types = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node["@graph"]) visit(node["@graph"]);
    const t = node["@type"];
    if (typeof t === "string") types.add(t.toLowerCase());
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x.toLowerCase()));
    for (const k of Object.keys(node)) if (typeof node[k] === "object") visit(node[k]);
  };
  ld.forEach(visit);
  return types;
}

function hasType(types, wanted) { return wanted.some((w) => types.has(w)); }

function blocksAiBots(robotsTxt) {
  if (!robotsTxt) return false;
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.trim().toLowerCase());
  let current = [];
  let blocked = false;
  for (const line of lines) {
    if (line.startsWith("user-agent:")) {
      const ua = line.split(":")[1].trim();
      current = line.startsWith("user-agent:") ? [ua] : current;
      if (ua === "*") current = ["*"];
      else current = [ua];
    } else if (line.startsWith("disallow:")) {
      const path = line.split(":")[1].trim();
      const hitsAi = current.some((ua) => AI_BOTS.includes(ua));
      if (hitsAi && (path === "/" || path === "")) blocked = path === "/";
    }
  }
  return blocked;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
