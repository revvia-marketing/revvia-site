# Photography gallery — drop photos here

Put high-resolution photos in **this folder** and they appear in the gallery at
**/work/photography**, automatically — no code changes. Astro optimizes every
image (responsive sizes + modern formats like WebP/AVIF), so just provide good
originals (JPG or PNG, ~2000px on the long edge is plenty).

After adding files: commit + push (or drop them in via GitHub's web UI). Netlify
rebuilds and the new photos go live.

## Filename = order, size, and caption

The filename controls everything:

```
01-big-lifestyle-hero.jpg   →  order 1, large tile, caption "Lifestyle Hero"
02-product-detail.jpg       →  order 2, normal tile, caption "Product Detail"
03-wide-on-location.jpg     →  order 3, wide tile,   caption "On Location"
04-tall-on-model.jpg        →  order 4, tall tile,   caption "On Model"
```

- **`NN-` prefix** (optional): a number to control the order they appear in.
- **`big` / `wide` / `tall`** (optional, right after the number): the tile size.
  - `big` = 2×2, `wide` = 2 columns, `tall` = 2 rows. Omit for a normal square.
- **The rest** becomes the caption (hyphens become spaces, Title Cased).
- Underscores work the same as hyphens.

Tip: make 2–3 of your strongest shots `big` or `wide` for an editorial, magazine
feel. Supported types: `.jpg .jpeg .png .webp .avif`.

While this folder is empty, the page shows gradient placeholders.
