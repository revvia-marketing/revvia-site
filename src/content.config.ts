import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import type { FaqItem } from './lib/schema';

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
      'west-coast-dtc',
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

/**
 * The three Revvia Journal publications. Single source of truth for each
 * publication's identity (label, slug, accents), masthead copy (oneLiner +
 * intro), behaviour (`type`: a get-featured "feature" series vs Tim's "column"),
 * and - for feature series - the get-featured invite/CTA and FAQ set.
 */
type Publication = {
  label: string;
  slug: string;
  /** "feature" = get-featured series (invite + FAQ); "column" = Tim's essays. */
  type: 'feature' | 'column';
  accent: string;
  cardBg: string;
  barBg: string;
  /** Short tagline - hub cards + masthead sub. */
  oneLiner: string;
  /** Prestige "What is X?" framing - publication page body. */
  intro: string;
  /** "All notes / features →" link label on the hub. */
  allLabel: string;
  /** Inline invite strip shown under the article grid (feature series). */
  invite?: { title: string; text: string };
  /** Closing CTA band. */
  cta: { heading: string; lead: string; buttonLabel: string };
  /** FAQ accordion (feature series only). */
  faqs?: FaqItem[];
  /** "Get featured" page: lead + how-it-works steps (feature series only). */
  getFeatured?: {
    lead: string;
    noun: 'business' | 'brand';
    locationLabel: string;
    locationPlaceholder: string;
    process: { title: string; text: string }[];
  };
};

export const SERIES_META = {
  'founders-notes': {
    label: "Founder's Notes",
    slug: 'founders-notes',
    type: 'column',
    accent: '#C24DE0',
    cardBg: 'linear-gradient(150deg,#8A0FAD,#2a1140)',
    barBg: 'linear-gradient(90deg,#8A0FAD,#B5179E)',
    oneLiner: 'The thinking behind the work.',
    intro:
      "Notes from the founder. Essays on building consumer and lifestyle brands, the marketing that actually moves revenue, and what we're learning running a production-led studio in San Diego. Written by Tim Holt, founder of Revvia.",
    allLabel: 'All notes',
    cta: {
      heading: 'Work directly with the founder.',
      lead: "Founder's Notes is the thinking. A growth audit is where we apply it to your brand - we'll show you exactly where the revenue is hiding.",
      buttonLabel: 'Get a Growth Audit',
    },
  },
  'built-in-san-diego': {
    label: 'Built in San Diego',
    slug: 'built-in-san-diego',
    type: 'feature',
    accent: '#F26A7E',
    cardBg: 'linear-gradient(150deg,#EC4F65,#4a1626)',
    barBg: 'linear-gradient(90deg,#D6248F,#EC4F65)',
    oneLiner: 'The people building North County San Diego.',
    intro:
      "Built in San Diego is a free feature series by Revvia that tells the stories of the real people behind North County San Diego's local businesses - the founders, the operators, and the builders who make this community worth living in. Every feature includes a professionally written article, a live backlink, and an owner's story told the way it deserves to be told.",
    allLabel: 'All features',
    invite: {
      title: 'Run a North County business?',
      text: 'We feature local builders for free - a published article, a backlink, and your story told right.',
    },
    cta: {
      heading: 'Want to be featured in Built in San Diego?',
      lead: "It's free, and there's no catch. Tell us about your business and we'll set up a short interview.",
      buttonLabel: 'Get featured',
    },
    faqs: [
      { question: 'Is being featured really free?', answer: "Yes. A Built in San Diego feature costs nothing. We write it, publish it, and link to you. There's no fee and no catch." },
      { question: 'Who can be featured?', answer: 'North County San Diego local business owners - the founders, operators, and builders behind the businesses that make this community worth living in. If you run a real business here, you can be featured.' },
      { question: 'What do I actually get?', answer: "A professionally written article about you and your business, published on the Revvia Journal, with a live backlink to your site - plus a copy you're free to use anywhere." },
      { question: 'Do I own the content?', answer: "Yes. The story is about you - put it on your site, your socials, wherever you like. We keep it published here too." },
      { question: "What's the catch - are you going to sell me something?", answer: "No catch. We do this because we love this community and it's how people get to know Revvia. We may eventually reach out about working together - but never during the interview, and never as a condition of being featured." },
      { question: 'How do I get featured?', answer: "Use the Get featured button to tell us about your business. If it's a fit, we'll set up a short interview and take it from there." },
    ],
    getFeatured: {
      lead: "It's free, and there's no catch. Here's exactly how a Built in San Diego feature works - and how to get yours started.",
      noun: 'business',
      locationLabel: 'City or neighborhood',
      locationPlaceholder: 'Carlsbad, Encinitas, Vista…',
      process: [
        { title: 'Reach out', text: "Tell us about your business using the form below. If it's a fit - and for North County businesses it usually is - we'll reply to set up a time. It's free, with no catch." },
        { title: 'The interview, about 30 minutes', text: "A relaxed conversation about your story: why you started, what makes your business different, who your customers are, and what you'd want people to know. No prep required - we're after the real story in your own words, not polished answers. It can help to think about a project you're proud of, what you wish more people knew, and how it all started." },
        { title: 'The photos', text: "We take a few candid photos of you at your location - in your space, doing what you do. They run with the article and are yours to use however you like afterward. If there's a corner or a wall that tells your story, we'll make sure to capture it." },
        { title: 'Your review and approval', text: "Before anything publishes, you review the article and approve your quotes - nothing goes live without your sign-off. We set that review session at the interview, usually about a week later." },
        { title: 'Published', text: "Your story goes live on the Revvia Journal: a professionally written article, a live backlink to your site, and a copy that's yours to share anywhere." },
      ],
    },
  },
  'west-coast-dtc': {
    label: 'West Coast DTC',
    slug: 'west-coast-dtc',
    type: 'feature',
    accent: '#FEB44E',
    cardBg: 'linear-gradient(150deg,#FE9C1C,#5a3408)',
    barBg: 'linear-gradient(90deg,#F77F3A,#FE9C1C)',
    oneLiner: 'The brands building the coast - and the content behind them.',
    intro:
      "West Coast DTC is Revvia's feature series on the founders and operators building the best consumer brands on the coast - and how they make the content that actually sells. Each feature is a published interview about the brand behind the brand: the story, the strategy, and the work behind the scroll. It's a place worth being featured - a professionally written piece, a live backlink, and your brand's story told properly.",
    allLabel: 'All features',
    invite: {
      title: 'Building a consumer brand on the coast?',
      text: 'We feature West Coast DTC brands for free - a published interview, a backlink, and your story told properly.',
    },
    cta: {
      heading: 'Want your brand featured in West Coast DTC?',
      lead: "It's free, and there's no catch. Tell us about your brand and we'll set up the interview.",
      buttonLabel: 'Get featured',
    },
    faqs: [
      { question: 'Is being featured free?', answer: "Yes. A West Coast DTC feature is free - no fee, no catch. We write it, publish it, and link to you." },
      { question: "Who's eligible?", answer: 'Consumer and lifestyle DTC brands building on the West Coast - apparel, beauty, wellness, accessories, home, and food and beverage. If you make a real brand and the content behind it, you qualify.' },
      { question: 'What do I actually get?', answer: 'A professionally written feature interview - the story, the strategy, and the work behind the scroll - published on the Revvia Journal with a live backlink, plus a copy you own and can share anywhere.' },
      { question: 'Do I own the content?', answer: "Yes. It's your story. Use it on your site and socials however you like; we keep it published here too." },
      { question: "What's the catch - is this a sales pitch?", answer: 'No catch. We feature brands we admire because it is how the right people get to know Revvia. We may eventually talk about working together - but never during the interview, and never as a condition of being featured.' },
      { question: 'How do I get featured?', answer: "Use the Get featured button to tell us about your brand. If it's a fit, we'll set up the interview." },
    ],
    getFeatured: {
      lead: "It's free, and there's no catch. Here's exactly how a West Coast DTC feature works - and how to get yours started.",
      noun: 'brand',
      locationLabel: "Where you're based",
      locationPlaceholder: 'City, state',
      process: [
        { title: 'Reach out', text: "Tell us about your brand using the form below. If it's a fit, we'll reply to set up the interview. It's free, with no catch." },
        { title: 'The interview, about 30 minutes', text: "A relaxed conversation about the brand behind the brand: why you started, what makes the product different, who you're building for, and how you make the content that actually sells. No prep required - we want the real story in your own words. It can help to think about a launch or a piece of content you're proud of, what you wish more people knew, and how it all started." },
        { title: 'The visuals', text: "Where it makes sense, we capture a few photos to run with the piece - in your space or with your product. They're yours to use however you like afterward." },
        { title: 'Your review and approval', text: "Before anything publishes, you review the feature and approve your quotes - nothing goes live without your sign-off. We set that review session at the interview, usually about a week later." },
        { title: 'Published', text: "Your feature goes live on the Revvia Journal: a professionally written piece, a live backlink to your site, and a copy that's yours to share anywhere." },
      ],
    },
  },
} as const satisfies Record<string, Publication>;

export type SeriesKey = keyof typeof SERIES_META;
