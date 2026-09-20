/**
 * Single source of truth for sitewide constants - NAP, socials, nav,
 * and contact details. Imported by Nav, Footer, SEO, and the JSON-LD
 * builders so nothing is hard-coded twice.
 */

export const SITE_URL = (
  import.meta.env.PUBLIC_SITE_URL || 'https://www.revvia.com'
).replace(/\/$/, '');

export const SITE_NAME = 'Revvia';
export const LEGAL_NAME = 'First Door, LLC';
export const TAGLINE = 'Marketing how it should be.';
export const DEFAULT_DESCRIPTION =
  'Revvia is a San Diego, production-led, full-service growth studio - full-stack and in person, run by the founder. We serve home services, B2B and industrial, healthcare and professional practices, and consumer brands. Revenue over impressions, month-to-month.';

/** Default Open Graph share image (generated from the logo, 1200×630). */
export const DEFAULT_OG_IMAGE = '/og/revvia-og.png';

/** Name, Address, Phone - the canonical business record. */
export const NAP = {
  name: SITE_NAME,
  legalName: LEGAL_NAME,
  description:
    'San Diego production-led, full-service growth studio - full-stack and in person. Paid media, in-house production, retention, SEO/GEO, and clean tracking for home services, B2B, healthcare, and consumer businesses across Southern California.',
  email: 'info@revvia.com',
  /** E.164 for schema / tel: links. */
  telephone: '+1-760-782-2875',
  telephoneDisplay: '(760) 782-2875',
  priceRange: '$$$',
  address: {
    streetAddress: '5927 Priestly Drive, Suite 212',
    addressLocality: 'Carlsbad',
    addressRegion: 'CA',
    postalCode: '92008',
    addressCountry: 'US',
  },
  geo: { latitude: 33.1281, longitude: -117.2655 },
  areaServed: [
    'San Diego County',
    'North County San Diego',
    'Orange County',
    'Southern California',
  ],
  openingHours: {
    days: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ],
    opens: '09:00',
    closes: '17:00',
  },
} as const;

export const SOCIALS = [
  'https://www.instagram.com/revviamarketing/',
  'https://x.com/RevviaMarketing',
  'https://www.linkedin.com/company/revvia/',
  'https://www.facebook.com/firstdoormarketing/',
] as const;

/** Primary navigation - used by both desktop nav and the mobile drawer. */
export type NavChild = { label: string; href: string };
export type NavItem = { label: string; href: string; children?: readonly NavChild[] };

export const NAV_LINKS: readonly NavItem[] = [
  { label: 'Services', href: '/services' },
  { label: 'Work', href: '/work' },
  { label: 'About', href: '/about' },
  {
    label: 'Journal',
    href: '/journal',
    children: [
      { label: 'Journal', href: '/journal' },
      { label: "Founder's Notes", href: '/journal/founders-notes' },
      { label: 'Built in San Diego', href: '/journal/built-in-san-diego' },
      { label: 'West Coast DTC', href: '/journal/west-coast-dtc' },
    ],
  },
];

/** The Journal publications - for the footer sub-list. */
export const JOURNAL_LINKS: readonly NavChild[] = [
  { label: "Founder's Notes", href: '/journal/founders-notes' },
  { label: 'Built in San Diego', href: '/journal/built-in-san-diego' },
  { label: 'West Coast DTC', href: '/journal/west-coast-dtc' },
];

/** Service lines - the single source for nav copy, JSON-LD knowsAbout, etc. */
export const SERVICE_LINES = [
  'Search engine optimization',
  'Generative engine optimization',
  'Google Ads management',
  'Meta advertising',
  'Brand development',
  'Commercial video production',
  'Conversion tracking',
  'Fractional CMO services',
] as const;

/**
 * Topical expertise for JSON-LD knowsAbout - the subjects the studio is an
 * authority on, drawn from what the site actually asserts. Complements
 * SERVICE_LINES (the offerings) and the industries in SEGMENTS.
 */
export const EXPERTISE_TOPICS = [
  'AI search visibility',
  'Answer engine optimization',
  'Local SEO',
  'HIPAA-compliant advertising',
  'Conversion rate optimization',
  'Marketing attribution',
] as const;

/**
 * The verticals Revvia serves - drives the "Who we work with" block, the
 * dedicated page, and the Service audience in JSON-LD. Plain declarative
 * statements, DTC as one segment among several.
 */
export const SEGMENTS = [
  { label: 'Home services and trades', blurb: 'Revvia works with construction, plumbing, and contracting businesses - brand, video, search, AI visibility, and paid media that bring in qualified jobs.', href: '/work/steady-builders' },
  { label: 'B2B and industrial', blurb: 'Revvia works with manufacturers, fabricators, fulfillment operations, and engineering firms that sell to other businesses.', href: '/journal/tmc-engineering' },
  { label: 'Healthcare and professional practices', blurb: 'Revvia works with medical practices and professional services firms, with HIPAA-compliant advertising and lead tracking for healthcare.', href: '/work/coastal-internal-medicine' },
  { label: 'DTC and ecommerce', blurb: 'Revvia works with consumer brands across retail and wholesale - paid media, in-house content, and retention.', href: '/work/peter-grimm' },
  { label: 'Education and specialty', blurb: 'Revvia works with schools, nonprofits, and niche consumer services.', href: null },
] as const;

export const CTA = { label: 'Get a Growth Audit', href: '/contact' } as const;

/** Footer link set (primary links + Contact). */
export const FOOTER_LINKS = [
  ...NAV_LINKS,
  { label: 'Contact', href: '/contact' },
] as const;

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`);
}
