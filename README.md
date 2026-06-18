# Revvia — DTC Growth Studio website

Production-led DTC growth studio site, built with **Astro** (static-first),
**Keystatic** (Git-based CMS), and deployed to **Netlify**. Dark theme, the
purple→gold brand gradient, Bricolage Grotesque + Inter.

---

## Run it locally

Prerequisites: **Node 20+** and npm.

```bash
npm install        # install dependencies
npm run dev        # start the dev server → http://localhost:4321
```

Other commands:

```bash
npm run build      # production build into dist/ (runs prebuild asset gen first)
npm run preview    # not used — this site uses the Netlify adapter; use `netlify dev`
npm run gen-assets # regenerate OG image + favicons from the logo
```

The CMS admin is at **http://localhost:4321/keystatic** (local mode in dev).

---

## Environment variables

Copy `.env.example` to `.env` for local dev. In production, set these in the
**Netlify dashboard → Site settings → Environment variables**. Everything
prefixed `PUBLIC_` is intentionally exposed to the browser.

| Variable | Required? | What it's for |
|---|---|---|
| `PUBLIC_SITE_URL` | optional | Canonical site URL. Defaults to `https://www.revvia.com`. Only set if the domain/host changes. |
| `PUBLIC_GA4_ID` | for analytics | GA4 Measurement ID for the **revvia.com** property, e.g. `G-XXXXXXXXXX`. Leave blank and no GA beacon loads. |
| `PUBLIC_META_PIXEL_ID` | for analytics | Meta (Facebook) Pixel ID for the agency site, e.g. `1234567890123456`. Blank = no pixel. |
| `KEYSTATIC_GITHUB_CLIENT_ID` | for CMS in prod | GitHub App "Client ID" (from the Create-GitHub-App flow). |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | for CMS in prod | GitHub App client secret. |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | for CMS in prod | GitHub App slug, i.e. the `<slug>` in `github.com/apps/<slug>`. |
| `KEYSTATIC_SECRET` | for CMS in prod | Random 32-byte hex string Keystatic uses to sign sessions. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |

The repo Keystatic commits to is hard-coded in `keystatic.config.tsx`
(`revvia-marketing/revvia-site`) — no env var for it.

> Analytics and the Pixel are **off** until their IDs are set, so local dev and
> previews never fire beacons. Consent default is privacy-forward (ad storage
> denied, analytics allowed).

---

## Content management (Keystatic)

- Admin UI: **`/keystatic`**. In `npm run dev` it runs in **local mode** (edits
  write straight to `src/content/` — no GitHub credentials needed).
- In production it runs in **GitHub mode**: publishing commits to
  `revvia-marketing/revvia-site` and triggers a Netlify rebuild.

### One-time GitHub-mode auth setup

1. Deploy to Netlify so `/keystatic` is live on a public URL.
2. Visit `https://<your-site>/keystatic`. Keystatic detects no GitHub App and
   shows a **"Create GitHub App"** button — click it. It sends you to GitHub
   with a prefilled manifest (correct permissions + callback URL), you confirm,
   and GitHub creates the App and installs it on the repo.
3. Keystatic then shows the **Client ID**, **Client Secret**, and **App slug**.
   Copy them into Netlify env vars (`KEYSTATIC_GITHUB_CLIENT_ID`,
   `KEYSTATIC_GITHUB_CLIENT_SECRET`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`).
4. Add `KEYSTATIC_SECRET` (a random 32-byte hex string you generate).
5. Redeploy. `/keystatic` now signs editors in with GitHub and commits on save.

If you ever move `/keystatic` to a different domain, update the GitHub App's
OAuth callback URL to `https://<new-domain>/api/keystatic/github/oauth/callback`.

- Collections:
  - **Journal** (`src/content/journal/*.mdoc`) — one collection split into three
    series via the `series` field: Founder's Notes, Built in San Diego, Coastal
    Drop Founders. Renders the hub (`/journal`), the three series pages, and each
    post at `/journal/<slug>` (Article + Breadcrumb schema).
  - **Case Studies** (`src/content/case-studies/*.mdoc`) — renders at
    `/work/<slug>` with the case-study template (Article + Breadcrumb schema).
    Authors can drop a revenue chart inline with the `{% barchart %}` tag.

Editors (Tim, Kennedi) create and publish entirely through the Keystatic UI.

---

## Forms & lead capture

The **Growth Audit form** (homepage + `/contact`) is wired for **Netlify Forms**
(`data-netlify` + a honeypot). On submit it shows an in-page success state and
fires a GA4 `generate_lead` event and a Meta Pixel `Lead` event.

After the first deploy, in the Netlify dashboard:

1. **Forms → Form notifications** → add an email notification to Jan (and Tim).
2. (Optional) Pipe submissions to a Google Sheet via a free Make.com/Zapier
   scenario listening to Netlify's "form submission" webhook. Store that webhook
   URL in the scenario — never in the repo.

No CRM is wired (per spec — defer GoHighLevel etc. until after the first client).

---

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import from GitHub**, pick the repo.
3. Build settings are auto-detected (`netlify.toml`): build `npm run build`,
   publish `dist`. The Astro Netlify adapter handles the `/keystatic` server
   function and emits `_redirects`.
4. Add the environment variables above.
5. Deploy. Then point **revvia.com** at the Netlify site (DNS) last.

`robots.txt` and `sitemap-index.xml` are generated automatically. 301 redirects
from the old Wix URLs are defined in `astro.config.mjs` and emitted to
`_redirects`.

---

## Replaceable placeholders

These are intentional placeholders, built to swap in real assets easily:

- **Hero reel** (homepage): a gradient placeholder. Swap for the `Video`
  component (`<Video provider="vimeo" id="…" />`) when the anthem reel is ready.
  Video is **never self-hosted** — host on Vimeo or Mux.
- **Galleries** (service + photography pages): gradient `Gallery` tiles. Pass
  real `image` paths per tile, or wire them through Keystatic.
- **Team avatars** (About): gradient initials. Drop in real photos.
- **Journal / case-study cover images**: optional; run through Astro's image
  pipeline (`src/assets/...`) when added in Keystatic.

---

## Project structure

```
src/
  components/   Nav (+ mobile menu), Footer, SEO, SchemaJsonLd, Analytics,
                Button, Eyebrow, CTASection, Gallery, Video, Faq, Breadcrumbs,
                ServiceCard, CaseCard, PostCard, Barchart, GrowthAuditForm,
                SeriesListing
  layouts/      BaseLayout, LegalLayout
  lib/          site.ts (NAP/nav/socials), schema.ts (JSON-LD), images.ts, format.ts
  pages/        all routes (see the site map in REVVIA-SITE-SPEC.md)
  content/      journal/ + case-studies/ (.mdoc, managed by Keystatic)
  styles/       global.css (single set of design tokens + shared components)
  assets/       revvia-logo.png + CMS images
public/         robots.txt, favicons, og/ share images
keystatic.config.tsx, astro.config.mjs, markdoc.config.mjs, netlify.toml
scripts/gen-assets.mjs   generates OG image + favicons from the logo
```

*Revvia — Marketing how it should be.*
