import type { ImageMetadata } from 'astro';

/**
 * Resolve a Keystatic-stored image path (e.g. "/src/assets/journal/foo.jpg")
 * to an imported ImageMetadata so it can be run through Astro's <Image>
 * pipeline. Returns undefined when there's no image, so callers can fall back
 * to the gradient placeholder.
 */
const assets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{jpeg,jpg,png,gif,webp,avif}',
  { eager: true }
);

export function resolveImage(path?: string): ImageMetadata | undefined {
  if (!path) return undefined;
  const key = path.startsWith('/') ? path : `/${path}`;
  return assets[key]?.default;
}

/**
 * Resolve a card cover image by base name from src/assets/covers/, regardless
 * of extension. Drop e.g. `peter-grimm.jpg` in that folder and the matching
 * card's gradient is replaced by the photo. Returns undefined → keep gradient.
 */
const covers = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/covers/*.{jpeg,jpg,png,gif,webp,avif}',
  { eager: true }
);
const coverByName = new Map(
  Object.entries(covers).map(([path, mod]) => [
    (path.split('/').pop() ?? '').replace(/\.[^.]+$/, ''),
    mod.default,
  ])
);

export function resolveCover(name: string): ImageMetadata | undefined {
  return coverByName.get(name);
}
