import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content collections back the Keystatic CMS. Keystatic commits `.mdoc`
 * files here; Astro reads + renders them. The entry `id` is the URL slug.
 * Cover/OG images are stored as string paths under src/assets and resolved
 * through Astro's image pipeline in the page (see src/lib/images.ts).
 */

const journal = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    series: z.enum([
      'founders-notes',
      'built-in-san-diego',
      'coastal-drop-founders',
    ]),
    date: z.coerce.date(),
    excerpt: z.string(),
    coverImage: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional(),
  }),
});

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/case-studies' }),
  schema: z.object({
    client: z.string(),
    category: z.string().default('Photo + Video'),
    eyebrow: z.string().optional(),
    summary: z.string(),
    transform: z
      .object({
        fromLabel: z.string().optional(),
        fromValue: z.string().optional(),
        delta: z.string().optional(),
        toLabel: z.string().optional(),
        toValue: z.string().optional(),
        toSub: z.string().optional(),
      })
      .optional(),
    date: z.coerce.date().optional(),
    coverImage: z.string().optional(),
    stats: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .default([]),
    ctaHeading: z.string().optional(),
    ctaLead: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
  }),
});

export const collections = { journal, caseStudies };

/** Human labels + brand accents for the three journal series. */
export const SERIES_META = {
  'founders-notes': {
    label: "Founder's Notes",
    slug: 'founders-notes',
    accent: '#C24DE0',
    cardBg: 'linear-gradient(150deg,#8A0FAD,#2a1140)',
    barBg: 'linear-gradient(90deg,#8A0FAD,#B5179E)',
    desc: 'Field notes from Tim and the team — growth lessons, hard-won opinions, and the occasional look behind the curtain of running a production-led studio.',
    allLabel: 'All notes',
  },
  'built-in-san-diego': {
    label: 'Built in San Diego',
    slug: 'built-in-san-diego',
    accent: '#F26A7E',
    cardBg: 'linear-gradient(150deg,#EC4F65,#4a1626)',
    barBg: 'linear-gradient(90deg,#D6248F,#EC4F65)',
    desc: "Feature stories of the founders, operators, and builders behind North County's best local businesses. Each one gets a published article, a live backlink, and their story told right.",
    allLabel: 'All features',
  },
  'coastal-drop-founders': {
    label: 'Coastal Drop Founders',
    slug: 'coastal-drop-founders',
    accent: '#FEB44E',
    cardBg: 'linear-gradient(150deg,#FE9C1C,#5a3408)',
    barBg: 'linear-gradient(90deg,#F77F3A,#FE9C1C)',
    desc: 'The consumer brands and the founders building them on the SoCal coast — heritage labels, challenger brands, and the drops worth knowing about.',
    allLabel: 'All founders',
  },
} as const;

export type SeriesKey = keyof typeof SERIES_META;
