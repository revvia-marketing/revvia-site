import type { ImageMetadata } from 'astro';
import type { Tile } from '../components/Gallery.astro';

type GlobModules = Record<string, { default: ImageMetadata }>;

const SPANS = ['big', 'wide', 'tall'] as const;
type Span = (typeof SPANS)[number];

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Turn a folder of imported images (from import.meta.glob(..., { eager: true }))
 * into Gallery tiles. The filename drives everything - no code edits per photo:
 *
 *   01-big-lifestyle-hero.jpg  → order 1, big tile, label "Lifestyle Hero"
 *   wide-on-location.jpg       → wide tile, label "On Location"
 *   product-detail.jpg         → normal tile, label "Product Detail"
 *
 * Leading "NN-" sets sort order; an optional big|wide|tall token sets the span;
 * the rest becomes the (title-cased) label. Underscores work like hyphens.
 */
export function buildGalleryTiles(modules: GlobModules): Tile[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([path, mod]) => {
      const file = path.split('/').pop() ?? '';
      const base = file.replace(/\.[^.]+$/, '').replace(/_/g, '-');
      let tokens = base.split('-').filter(Boolean);

      // drop a leading numeric ordering prefix (e.g. "01")
      if (tokens.length > 1 && /^\d+$/.test(tokens[0])) tokens = tokens.slice(1);

      // optional span keyword
      let span: Span | undefined;
      if (tokens.length > 1 && (SPANS as readonly string[]).includes(tokens[0])) {
        span = tokens[0] as Span;
        tokens = tokens.slice(1);
      }

      const label = titleCase(tokens.join(' ')) || 'Photo';
      return { label, span, img: mod.default } satisfies Tile;
    });
}
