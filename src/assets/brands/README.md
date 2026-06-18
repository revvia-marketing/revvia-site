# Brand logos — social-proof strip

Drop client logo files in **this folder** and they appear in the logo strip
under the homepage hero, automatically — no code changes.

**Easiest way (no local setup):** upload through GitHub's web UI →
`src/assets/brands/` → **Add file → Upload files** → commit. Netlify rebuilds
and the logos go live.

## What to provide

- **PNG (transparent background) or SVG** look best — they’re shown monochrome
  (white) on the dark strip and turn full-color on hover.
- One file per brand. The filename becomes the logo’s alt text:
  - `peter-grimm.png` → alt “Peter Grimm”
  - `01-eversun.svg` → alt “Eversun”, shown first (the leading `01-` just sets order)
- Supported types: `.png .svg .jpg .webp`. Aim for a transparent logo roughly
  300–600px wide; the strip scales them to a consistent height.

While this folder is empty, the strip shows client names as text chips instead.
