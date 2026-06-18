# Revvia Site — Positioning Update Brief (for Claude Code)

**What this is.** The Revvia site is already built (Astro, per `REVVIA-SITE-SPEC.md`). This brief is a set of **targeted edits to the existing site** — do not rebuild from scratch. It repositions the site around what actually wins in our market, adds one marquee case study, and adds one comparison section. When you're done, **also update `REVVIA-SITE-SPEC.md`** to reflect these changes so the spec stays the source of truth.

Keep everything already built intact: all SEO/GEO and schema, the mobile hamburger menu, Keystatic, Netlify Forms + conversion events, redirects, the image pipeline. These edits are about **copy, positioning, two new assets, and the design tokens you already have** — not infrastructure.

---

## 0. The strategic shift — read this first (it explains every edit below)

We pressure-tested our differentiators against ~20 competitors. The finding: most of what we were leading with — in-house production, full-stack, senior-led, honest measurement, month-to-month — are **parity claims** that national agencies make too. So:

- **Never frame a capability as unique** ("the only ones who do X"). It's false and it backfires.
- **Local is the frame, not a bullet.** In San Diego, "local + in person" is the single strongest buying preference. The whole site should feel like a local studio, not a generic remote agency.
- **Lead with proof, then local/in-person, then right-for-your-size, then founder, then the story.** Demote the parity capabilities to qualifiers and proof points.
- **Audience is "consumer & lifestyle brands," not "DTC/ecommerce only"** — this is more accurate and lets our best local proof (EverSun, a 28-location brand) belong.

Anchor positioning line (use as the conceptual north star, and as meta/OG description fodder):

> The San Diego growth studio that actually shows up — full-stack and in person, run by the founder, for brands too big for a freelancer and too small for the national agencies.

---

## 1. Positioning vocabulary — global find-and-repoint

Across the site, shift the audience and identity language:

- **Audience:** replace "DTC / ecommerce brands" as the *headline* descriptor with **"consumer & lifestyle brands."** Keep "Shopify," "DTC," and "ecommerce" where they're literally accurate (many clients are DTC), but the top-line audience is consumer & lifestyle brands — which includes multi-location and physical/membership brands, not only online stores.
- **Identity:** we are a **San Diego, production-led growth studio for consumer & lifestyle brands.** Make "San Diego" / local visible in the identity, not just the footer.
- Keep the existing **"Southern California served, San Diego based"** logic: San Diego/North County is the home base and production hub; the growth stack serves SoCal. Don't narrow to "San Diego only," and don't broaden to "anywhere."
- Tagline stays: **"Marketing how it should be."**

---

## 2. Homepage hero — rewrite

Replace the current hero (`H1` "We run the whole stack…" + subhead) with copy that leads on whole-engine + local + in person. Use this, matching the site's existing type styles and gradient treatment:

- **Eyebrow:** `San Diego · Consumer & Lifestyle Brands`
- **H1:** `We run your whole growth engine — in person, right here in San Diego.`
- **Subhead:** `Paid media, in-house production, retention, and clean tracking — one local studio for consumer and lifestyle brands. A senior team you can sit across the table from, built for your size. Revenue over impressions, month-to-month.`

Keep the gradient on one phrase of the H1 (e.g., gradient "in person, right here in San Diego"). Keep the existing reel/CTA placement.

---

## 3. The "what makes us different" section — reframe and reorder

This is the section currently headed **"We're in your warehouse with a camera"** with four cards ("Four things that make us different from the media shop down the street").

- **Keep the H2** "We're in your warehouse with a camera." — it's our best line and it already says local + in person.
- **Change the subhead** from "Four things that make us different…" to: `What you get from a local studio that runs your whole growth engine.` (Drops the implied "we're unique" framing.)
- **Reorder and rewrite the four cards** so local leads and the two pure parity claims (honest measurement, month-to-month) come out as cards. New four cards, in this order:

```
1. Local & in person
   We're a San Diego studio, and we show up — to plan, to shoot, to fix
   things in the room. Your growth team is here, not a screen in another
   time zone.

2. In-house production, on location
   We shoot your photo, video, and lifestyle content ourselves — on
   location, in person, not art-directed over Slack.

3. You work with the founder
   You get the owner on your account, not a junior learning on your budget.

4. Built for your size
   Right-sized for $300K–$8M brands — too big for a freelancer, too small
   to be a rounding error at a national agency. Senior attention either way.
```

- **Remove "in America"** from the production card entirely (it points national; our edge is local). The reframed card above already replaces it.
- The two demoted claims — **honest measurement** and **month-to-month** — should not disappear; move them to a small qualifier/trust strip near this section or the hero, e.g. a single line: `Revenue, not vanity metrics. Month-to-month, no lock-ins. We win when you win.`

---

## 4. Proof — elevate it

Proof is our real differentiator, so it should sit high and feature our marquee local brand.

- Keep the **"Proof, not promises."** section and, if anything, move it **above** the differentiator section on the homepage.
- Feature **EverSun (see §5) as the lead case card** on the homepage proof section, ahead of Peter Grimm and Voyage Air. It's the most recognizable local name we have.

---

## 5. New case study — EverSun (formerly iTAN) — marquee local proof

A finished design for this page is provided as **`case-study-eversun.html`** — treat it as the **design + content source of truth.**

- **Integrate it the same way the other case studies work.** The existing case studies are CMS-driven (Keystatic `caseStudies`). Add EverSun as a case study at **`/work/eversun`**. If the current case-study template/markdoc can't express EverSun's structure (it's findings-and-architecture, not a single bar chart), either extend the template to support these blocks or build EverSun as a dedicated page using the provided HTML as the design reference — either is fine, but it must match the site's look and be linked like the others.
- **Preserve EverSun's specific structure** from the provided file, in order: hero with a "formerly iTAN" sub and a *Before → With Revvia* transform (`5+ vendors → one system`); the 4-stat band; **The Brand**; **The Challenge** (4 "leak in the seams" findings); **What the Data Revealed** (3 insight cards — first-90-days, routine-beats-purchase, members-not-signups); **What We Built** (4 architecture cards); **The Results**; **The Takeaway**.
- **Do not invent results.** The Results section is an intentional placeholder ("Measurement underway") with a hidden `TODO` comment listing the real numbers to add later. Keep it exactly as a placeholder. Keep the HTML comment at the top of the file flagging that results are pending, financials are genericized, and EverSun must approve specifics before publishing.
- **Add EverSun to the Work index** (`/work`) as a case card, and as the lead card on the homepage proof section (per §4).
- Article schema is already in the file — preserve it.

---

## 6. New section — the "how to choose" comparison

Add a comparison section to the homepage (below proof / near the differentiators) — and optionally reuse it on `/about` or `/work`. Build it on-brand with the existing dark theme and gradient. **Use categories, never named competitors.**

- **Eyebrow:** `How to choose`
- **H2:** `Same goal. Three very different fits.`
- **Intro line:** `Most agencies are either a national machine or a local site builder. We're the one studio that's both — local and in person, running your whole growth engine.`

**Columns:** `National growth agency` · `Local web/CRO shop` · `Revvia` (highlight the Revvia column with a subtle gradient border/background).

**Rows and marks** (✓ = gradient or green check, ✗ = muted, ? = muted question mark):

| Row | National agency | Local web/CRO shop | Revvia |
|---|:---:|:---:|:---:|
| Runs your full growth engine — paid · creative · retention · tracking | ✓ | ✗ | ✓ |
| Shoots your content in person, on location | ✗ | ✗ | ✓ |
| Local San Diego studio that knows your market | ✗ | ✓ | ✓ |
| Right-sized for a $300K–$8M brand | ✗ | ✓ | ✓ |
| You work directly with the founder | ✗ | ? | ✓ |

- **Tone is fit, not "we win."** No concession/"enterprise" row — keep it to these five.
- **Responsive:** a 3-column table is hard on phones. On small screens, collapse to a stacked, per-column card layout (or a transposed/scrollable view) so every cell stays readable. Make sure the marks have text labels for accessibility (e.g., `aria-label="included"` / `"not included"` / `"depends on the shop"`).

---

## 7. Keep / don't break

- All SEO/GEO, JSON-LD schema per page, sitemap, robots, canonical/OG, breadcrumbs.
- Mobile hamburger menu, Keystatic admin + collections, Netlify Forms + GA4/Meta lead events, 301 redirects, Astro image pipeline.
- **About page must have NO team section** (the roster is in flux) — confirm it's absent; remove it if an earlier build included it.
- Keep the strong lines we already have: "Proof, not promises," "you get the founder," "We're in your warehouse with a camera."

---

## 8. Update the spec

After applying the above, update **`REVVIA-SITE-SPEC.md`** so it matches the repositioned site:

- Brand/positioning section → "consumer & lifestyle brands," San Diego/local-first identity, the anchor positioning line, and the moat hierarchy (proof → local/in-person → right-sized → founder → story; capabilities are qualifiers, never claimed as unique).
- Site map → add `/work/eversun`.
- Add the comparison section to the homepage spec and the component list.
- Note the EverSun results are a placeholder pending real numbers and client approval.

---

*Apply these as edits, keep the build green for Netlify, and confirm the acceptance checklist in the spec still passes after the changes.*
