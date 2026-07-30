import { getCollection, type CollectionEntry } from 'astro:content';

type JournalPost = CollectionEntry<'journal'>;

/**
 * Publish-date gate for the Journal. A post whose `date` is in the future is
 * treated as scheduled: excluded from every listing, its own page, and the
 * sitemap until its date arrives. The comparison uses the build-time clock,
 * so a rebuild after the date is what flips it live - see the daily Netlify
 * scheduled rebuild (netlify/functions/rebuild.mjs).
 */
export function isPublished(post: JournalPost, now: Date = new Date()): boolean {
  return post.data.date.getTime() <= now.getTime();
}

/** Published journal posts (date has arrived), newest first. */
export async function getPublishedJournal(): Promise<JournalPost[]> {
  const now = new Date();
  const posts = await getCollection('journal', (post) => isPublished(post, now));
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
