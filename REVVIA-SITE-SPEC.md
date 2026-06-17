# Revvia Website — Master Build Spec

**Source of truth for building the Revvia site. Read this top to bottom before writing any code.**
Companion files: the twelve approved page mockups (HTML) in this folder are the exact visual reference. This document tells you how to turn them into a production Astro site. Where the mockups and this spec agree, follow them. Where this spec adds something the mockups only stub (mobile nav, sitemap, schema on every page, CMS, forms, redirects), implement it.

---

## 0. How to use this document

You are building the **entire** Revvia website. Do not skip sections. The mockups show the design; this spec covers everything the static mockups can't: the CMS, forms, schema on every page, the mobile menu, performance, redirects, and deploy readiness. When in doubt, match the mockups visually and follow this spec functionally. At the end is an acceptance checklist — the build is not done until every box is satisfied.

---

## 1. The brand

**Who we are.** Revvia is a production-led DTC growth studio in Carlsbad, California (legal entity: First Door, LLC). We run the full growth stack for brand-driven consumer brands — paid media, in-house creative and production, email/SMS retention, and clean tracking — and we report to revenue, not vanity metrics.

**What we're building.** The agency is specializing: away from a generalist local shop and toward brand-driven consumer/DTC brands (lifestyle, apparel, beauty, wellness, accessories, home, food & beverage) on Shopify, roughly $500K–$8M in revenue, concentrated in Southern California. The website must position us narrowly (DTC growth studio) while remaining credible to our existing local book.

**Positioning one-liner.** "We run the whole stack — so your brand actually grows."

**The pitch.** Most brands stitch together a media buyer, a freelance designer, and an email tool no one touches. We do all of it under one roof, shoot the creative ourselves, and make the whole engine work together — senior-led, month-to-month, measured against real revenue.

**Origin story (essence — full version lives on the About page).** Started in early 2020 as First Door Marketing to keep churches and nonprofits alive through the pandemic. Businesses noticed, came to us frustrated with their agencies, and our playbook worked — every business client grew at least 50% YoY within six months. The founding insight still runs everything: don't act like a marketing company; be the client's CMO and their whole team, and obsess over revenue. Founder Tim Holt started this as a pastor and says he "answers to a higher power than your checkbook."

**Who we serve (ICP).** Brand-driven consumer brands on Shopify, ~$500K–$8M revenue, Southern California (San Diego + Orange County core), founders who care about brand and are ready to actually grow. Not commodity/functional ecommerce.

**What makes us different (the moat).**
- **In-house production** — we shoot your creative ourselves ("we're in your warehouse with a camera"), in America. Not outsourced, not stock.
- **Full-stack** — media, creative, retention, and tracking under one roof, working together.
- **Senior-led** — the people who win the account run it.
- **Honest measurement** — revenue against real spend (blended MER), not platform-inflated metrics.
- **Month-to-month** — no lock-ins, no hidden fees; we'll tell you on the first call if we're not a fit.

**Voice & tone.** Confident, plain, honest, revenue-first. Short sentences. No jargon-as-decoration, no hype, no vanity metrics. We push back kindly and lead with proof. Signature line: **"Marketing how it should be."**

---

## 2. Design system

**Theme.** Dark. The brand lives on near-black with the gradient as the signature accent. Light text on dark throughout.

**Color tokens** (use these exact values as CSS custom properties):
```
--bg:      #0A0A0C   /* page background */
--bg-2:    #0E0F14   /* alt section background */
--card:    #15161D   /* cards */
--line:    #23242E   /* hairline borders */
--line-2:  #2E303B   /* stronger borders */
--text:    #FFFFFF
--muted:   #A7ADBA   /* secondary text */
--muted-2: #7A8090   /* tertiary text */
```

**The brand gradient** (the signature — sampled from the real logo). Stops:
- purple `#8A0FAD` → magenta `#D6248F` → coral `#EC4F65` → gold `#FE9C1C`
- Canonical: `linear-gradient(115deg,#8A0FAD 0%,#D6248F 38%,#EC4F65 64%,#FE9C1C 100%)`

**Gradient usage rule.** The gradient is a signature, not a wallpaper. Apply it to: the logo mark, eyebrows, one highlighted phrase per headline, key stat numbers, primary buttons, the play button, hover accents, and the "Marketing how it should be" tagline. Everything else is white/muted on dark. Do not gradient entire backgrounds or body text — that reads garish.

**Journal series accents** (within the brand palette):
- Founder's Notes → purple (`#8A0FAD` / `#B5179E`)
- Built in San Diego → coral/magenta (`#D6248F` / `#EC4F65`)
- Coastal Drop Founders → gold/orange (`#F77F3A` / `#FE9C1C`)

**Typography.**
- Display/headings: **Bricolage Grotesque** (weights 400–800), tight letter-spacing (~-0.02em), line-height ~1.05 on large headings.
- Body/UI: **Inter** (400/500/600).
- Numbers: Bricolage Grotesque, tabular-nums for stats.
- Load via Google Fonts with preconnect; fluid sizing via `clamp()` so type scales on mobile.

**Logo.** Use the transparent trimmed mark (the four-tile gradient mark) in the nav and footer, with "Revvia" as a white Bricolage Grotesque wordmark beside it. The mark file is in this folder; produce a proper favicon and an OG share image from it (see §5).

**Components (extract these as reusable Astro components — they repeat across pages):**
- `Nav` (sticky, blurred, logo + links + gradient CTA; includes the mobile menu — see §4)
- `Footer` (NAP line + footer nav + gradient tagline)
- `Button` (primary gradient, large, and ghost variants)
- `Eyebrow` (gradient uppercase label)
- `StatCard` / stat band
- `ServiceCard` / `ValueCard` (dark card, gradient number, title, copy)
- `CaseCard` (work cards with gradient media zone)
- `Gallery` (the asymmetric tile grid used on production + photography pages — supports `big`, `wide`, `tall` spans and a video badge)
- `PostCard` (journal)
- `GrowthAuditForm` (the contact form — see §8)
- `CTASection` (gradient-glow closing CTA)
- `SchemaJsonLd` (a component that injects the right JSON-LD per page — see §5)
- `SEO` (a `<head>` component for title/description/canonical/OG/Twitter per page)

**Spacing/shape/motion.** Generous section padding (~60–84px). Card radius 14–20px. Subtle hover lift (translateY -3/-4px) and gradient-shadow on primary buttons. Respect `prefers-reduced-motion` (disable transitions/scroll-behavior). Keep a max content width ~1080–1120px.

---

## 3. Site map & pages

Build all of the following. Routes are suggestions; keep them clean and lowercase.

| Page | Route | Source mockup |
|---|---|---|
| Home | `/` | revvia-homepage.html |
| Services | `/services` | services.html |
| Flagship Brand Film | `/services/flagship-brand-film` | flagship-brand-film.html |
| Seasonal Content Capsule | `/services/seasonal-content-capsule` | seasonal-content-capsule.html |
| Growth Foundation | `/services/growth-foundation` | growth-foundation.html |
| Drop Launch | `/services/drop-launch` | drop-launch.html |
| Work (index) | `/work` | work.html |
| Peter Grimm case study | `/work/peter-grimm` | case-study-peter-grimm.html |
| Voyage Air case study | `/work/voyage-air` | case-study-voyage-air.html |
| Photography & Production | `/work/photography` | photography.html |
| About | `/about` | about.html |
| Journal (hub) | `/journal` | journal.html |
| Contact / Growth Audit | `/contact` | contact.html |

**Journal series** (landing pages generated from the CMS — see §7):
- Founder's Notes → `/journal/founders-notes`
- Built in San Diego → `/journal/built-in-san-diego`
- Coastal Drop Founders → `/journal/coastal-drop-founders`
- Individual posts → `/journal/[slug]`

**Utility pages (build these too):**
- `404` — on-brand dark 404 with a gradient headline and links back to Home/Work/Contact.
- `/privacy` — privacy policy (placeholder copy; mark clearly as needing legal review).
- `/fulfillment` — fulfillment policy (Revvia already has one; required by payment processors — port/placeholder).
- `/terms` — terms (placeholder; legal review).

Internal links across the mockups currently point at flat filenames (e.g., `revvia-homepage.html#contact`). **Rewire all internal links to the clean routes above.** The nav CTA "Get a Growth Audit" should point to `/contact`.

---

## 4. Navigation

**Desktop nav** (sticky, blurred dark bar): logo + Services · Work · About · Journal · **Get a Growth Audit** (gradient button). "Work" houses the case studies and Photography. Mark the current section active.

**Mobile nav — REQUIRED, currently stubbed in the mockups.** On small screens the mockups hide the links and show only the logo + CTA. Replace this with a real **hamburger menu**: a button that opens an accessible full-screen or drawer menu listing Services, Work, About, Journal, and the Growth Audit CTA. Trap focus when open, close on Escape and on link click, animate gently, and respect reduced-motion. Build it as part of the `Nav` component.

**Footer nav.** Logo + the same primary links + the NAP line (Revvia — DTC Growth Studio · address · phone) + the gradient "Marketing how it should be."

---

## 5. SEO & GEO — the checklist

This is the part the agency sells, so it must be complete and consistent on **every** page.

**Per-page `<head>` (via the `SEO` component):**
- Unique `<title>` and meta `description`.
- `<link rel="canonical">` to the page's absolute URL.
- Open Graph (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image`) and Twitter card tags (`summary_large_image`).
- One shared OG share image (generate from the logo on the dark brand background, 1200×630) plus the ability to override per page (case studies and journal posts should be able to set their own).
- `<meta name="viewport">`, charset, theme-color (#0A0A0C).

**Structured data (JSON-LD) — apply the correct type per page:**
- **Sitewide:** `Organization` + `WebSite` (with `potentialAction` SearchAction if a search exists) in a shared layout.
- **LocalBusiness / `ProfessionalService`** on Home, About, and Contact — full NAP, `geo` (Carlsbad ≈ 33.1281, -117.2655), `openingHoursSpecification` (Mon–Fri 09:00–17:00 PT), `areaServed` (San Diego County, Orange County, Southern California), `priceRange`, `sameAs` socials, `telephone` +1-760-782-2875, `email` info@revvia.com, address 5927 Priestly Drive, Suite 212, Carlsbad, CA 92008. (The Contact page mockup already contains the validated block — reuse it.)
- **`FAQPage`** on Home (already present) — and add an FAQ block + schema to each Service/Production page (great for AI-search citation).
- **`Service`** on each Service/Production page (present in the mockups).
- **`Article`** on each case study and each journal post (with author, publisher, datePublished, image).
- **`AboutPage`** on About (present).
- **`ContactPage`** + **`BreadcrumbList`** on Contact (present).
- **`BreadcrumbList`** on all inner pages (Services children, Work children, Journal posts).
- **`ItemList`** on Work and Journal index pages.

**GEO (AI-search) specifics.** Lead with answer-first content, use clean semantic headings (one `<h1>` per page, logical `<h2>`/`<h3>`), keep FAQ schema rich, and make sure pages are fast and crawlable. The honest, declarative copy in the mockups is already written this way — preserve it.

**Crawl infrastructure.**
- Generate **`sitemap.xml`** (use `@astrojs/sitemap`).
- Add **`robots.txt`** allowing crawl and pointing to the sitemap.
- Semantic landmarks (`header`, `nav`, `main`, `footer`), descriptive `alt` on every image, and meaningful link text.

**Performance (Core Web Vitals — a ranking + mobile factor).** Static output, no render-blocking JS, fonts with `display=swap` + preconnect, and the Astro image pipeline for all raster images (responsive `srcset`, lazy-loading, AVIF/WebP). Target green CWV on mobile.

---

## 6. Tech stack

- **Astro** — static-first, fast, component-based. Build the site here.
- **Keystatic** — Git-based CMS for the Journal and case studies (admin at `/keystatic`, GitHub mode). Editors publish without code.
- **Netlify** — hosting + auto-deploy from GitHub, Netlify Forms for leads, free SSL. (Cloudflare Pages is an acceptable alternative if preferred.)
- Keep the **revvia.com** domain; point it at the new host last (see the Build & Launch Guide).

---

## 7. Content management (Keystatic)

Configure Keystatic in **GitHub mode**, admin UI at `/keystatic`. Collections:

**`journal`** (the three series share one collection, separated by a `series` field):
- `title` (text)
- `slug` (slug)
- `series` (select: `founders-notes` | `built-in-san-diego` | `coastal-drop-founders`)
- `date` (date)
- `excerpt` (text)
- `coverImage` (image — runs through Astro's pipeline)
- `body` (markdown/MDX)
- SEO overrides: `metaTitle`, `metaDescription`, `ogImage` (optional)

Generate the three series landing pages by filtering this collection on `series`, and a combined `/journal` hub matching the mockup (featured latest + three series bands with their accents). Each post renders with `Article` + `BreadcrumbList` schema.

**`caseStudies`** (so new case studies are easy to add):
- `client`, `slug`, `category`, `headlineStat`, `summary`, `coverImage`, `body`, plus structured stat fields. Render with the case-study template and `Article` schema.

Editors (Tim, Kennedi) should be able to create and publish entries entirely through the Keystatic UI; publishing commits to GitHub and triggers a Netlify rebuild.

---

## 8. Forms & lead capture

**The Growth Audit form** (on `/contact` and embedded on the homepage). Fields: name, business name, email, store URL, monthly budget (select), preferred contact method, message, plus a hidden honeypot (already in the mockups).

- Wire to **Netlify Forms** (`data-netlify="true"`, honeypot via `netlify-honeypot`). No backend needed at current volume.
- **Email notification** to Jan (and Tim) on every submission (Netlify form notifications).
- **Google Sheet**: pipe submissions to a Sheet via a free Make.com/Zapier scenario (document the hook; don't hardcode secrets).
- **Conversion tracking**: on successful submit, fire a GA4 event (`generate_lead`) and a Meta Pixel `Lead` event.
- Show a clear success state in-page after submit (the mockups demonstrate the copy).
- No CRM dependency — do **not** wire GoHighLevel or any paid CRM. Defer that until after the first client.

---

## 9. Analytics

- Stand up a **GA4 property for revvia.com** (the agency's own — separate from any client property) and install via a single shared layout snippet. Add a **Meta Pixel** for the agency site.
- Use environment variables for IDs; don't hardcode. Honor a basic consent posture (most-private default on any cookie/consent UI).

---

## 10. Media

- **Images:** all raster images go through Astro's image pipeline (responsive, lazy, AVIF/WebP). Provide high-res originals; never ship unoptimized images.
- **Video:** host on **Vimeo or Mux** and embed via a reusable `Video` component (by ID). **Never self-host video files** in the repo.
- **Placeholders to replace later:** the hero reel zone (homepage), all gallery tiles (production + photography pages), and the team avatars (About) are intentional placeholders. Build them so real assets drop in via Keystatic or a simple props/config change.

---

## 11. Redirects (preserve SEO from the old Wix site)

Add 301 redirects from the old Wix paths to the new routes:

```
/our-story          → /about
/team               → /about
/fractionalcmo      → /services
/singleservices     → /services
/digitaladvertising → /services
/seo-services       → /services
/customwebsites     → /services
/marketingsetupguide→ /services
/builtinsd          → /journal/built-in-san-diego
/faq                → /#faq
/fulfillment        → /fulfillment   (keep this policy page)
/contact            → /contact
```
Implement via Netlify `_redirects` (or `netlify.toml`). Confirm no important old URL 404s.

---

## 12. Accessibility

- WCAG-minded: sufficient contrast (the dark theme + white text passes; check muted text on cards), visible focus states on all interactive elements (gradient or solid outline), keyboard-operable nav and mobile menu, `prefers-reduced-motion` honored, semantic landmarks, descriptive alt text, and labelled form fields.

---

## 13. Acceptance criteria (definition of done)

The build is complete only when **all** of these are true:

- [ ] All 13 main pages + 3 journal series pages + post template + 404 + 3 policy pages build and render, matching the mockups visually (dark theme, exact gradient, fonts, layout).
- [ ] Shared `Nav`, `Footer`, `Button`, `Gallery`, form, and CTA are real reusable components — not copy-pasted per page.
- [ ] **Mobile hamburger menu** works (accessible, closes on Escape/link/click-out).
- [ ] Every page has a unique title, meta description, canonical, OG + Twitter tags, and the correct JSON-LD type. LocalBusiness on Home/About/Contact validates. FAQ schema on Home + every service page.
- [ ] `sitemap.xml` and `robots.txt` are generated and correct.
- [ ] Keystatic admin at `/keystatic` works in GitHub mode; the `journal` (3 series) and `caseStudies` collections publish and rebuild.
- [ ] The Growth Audit form submits via Netlify Forms, emails Jan, fires GA4 + Meta lead events, and shows a success state. Honeypot present.
- [ ] GA4 + Meta Pixel installed via env vars.
- [ ] All images run through Astro's pipeline; the reel/galleries/avatars are easy-to-replace placeholders; no self-hosted video.
- [ ] All old Wix URLs 301-redirect to the new routes.
- [ ] All internal links use clean routes (no leftover `*.html#*` links).
- [ ] Green Core Web Vitals on mobile; no console errors; `prefers-reduced-motion` respected.
- [ ] Builds cleanly for Netlify deploy.

---

*Revvia — Marketing how it should be.*
