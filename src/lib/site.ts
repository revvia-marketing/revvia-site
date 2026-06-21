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
  'Revvia is the San Diego production-led growth studio for consumer & lifestyle brands - full-stack and in person, run by the founder. Revenue over impressions, month-to-month.';

/** Default Open Graph share image (generated from the logo, 1200×630). */
export const DEFAULT_OG_IMAGE = '/og/revvia-og.png';

/** Name, Address, Phone - the canonical business record. */
export const NAP = {
  name: SITE_NAME,
  legalName: LEGAL_NAME,
  description:
    'San Diego production-led growth studio for consumer & lifestyle brands - full-stack and in person. Paid media, in-house production, retention, and clean tracking, serving Southern California.',
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
  areaServed: ['San Diego County', 'Orange County', 'Southern California'],
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
