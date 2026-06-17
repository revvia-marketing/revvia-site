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
