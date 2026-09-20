/**
 * JSON-LD builders. Every page composes the structured-data types the spec
 * requires by calling these helpers, so the shapes stay consistent and valid.
 * Returned objects are injected by <SchemaJsonLd /> (no @context duplication -
 * each top-level node carries its own).
 */
import {
  SITE_URL,
  SITE_NAME,
  NAP,
  SOCIALS,
  DEFAULT_DESCRIPTION,
  SERVICE_LINES,
  SEGMENTS,
  EXPERTISE_TOPICS,
  absoluteUrl,
} from './site';

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const LOCALBUSINESS_ID = `${SITE_URL}/#localbusiness`;
const PERSON_ID = `${SITE_URL}/#tim-holt`;
const LOGO_URL = absoluteUrl('/og/revvia-logo.png');

/** Industries served - mirrors the "Who we work with" segments. */
const INDUSTRIES_SERVED = SEGMENTS.map((s) => s.label);
/** Everything the entity is an authority on, for knowsAbout. */
const KNOWS_ABOUT = [...SERVICE_LINES, ...INDUSTRIES_SERVED, ...EXPERTISE_TOPICS];

const postalAddress = {
  '@type': 'PostalAddress',
  streetAddress: NAP.address.streetAddress,
  addressLocality: NAP.address.addressLocality,
  addressRegion: NAP.address.addressRegion,
  postalCode: NAP.address.postalCode,
  addressCountry: NAP.address.addressCountry,
};

/** Sitewide Organization node (lives in the base layout). */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    legalName: NAP.legalName,
    url: SITE_URL,
    logo: LOGO_URL,
    image: LOGO_URL,
    description: DEFAULT_DESCRIPTION,
    email: NAP.email,
    telephone: NAP.telephone,
    address: postalAddress,
    foundingDate: '2020',
    founder: { '@id': PERSON_ID },
    areaServed: NAP.areaServed.map((name) => ({
      '@type': 'AdministrativeArea',
      name,
    })),
    knowsAbout: KNOWS_ABOUT,
    makesOffer: SERVICE_LINES.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s, provider: { '@id': ORG_ID } },
    })),
    sameAs: [...SOCIALS],
  };
}

/**
 * Founder Person node - sitewide, referenced by Organization.founder and by
 * journal Article.author. The E-E-A-T anchor for the site's content and the
 * "Person schema" AI engines look for.
 */
export function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Tim Holt',
    jobTitle: 'Founder & CEO',
    worksFor: { '@id': ORG_ID },
    url: absoluteUrl('/about'),
    image: absoluteUrl('/tim-holt.jpg'),
    description:
      'Tim Holt is the founder and CEO of Revvia, a production-led, full-service growth studio in North County San Diego serving home services, B2B, healthcare, and consumer businesses. He started Revvia in 2020 while pastoring a church - which is why he likes to say he answers to a higher power than your checkbook. He builds on proof, not promises. A lifelong Southern Californian, Tim surfs, plays guitar, and lives in North County with his wife Meghan and their five kids.',
    knowsAbout: [...SERVICE_LINES, ...INDUSTRIES_SERVED],
  };
}

/** Sitewide WebSite node. */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
  };
}

/**
 * LocalBusiness / ProfessionalService - used on Home, About, Contact.
 * Full NAP + geo + hours + areaServed + priceRange + sameAs.
 */
export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': LOCALBUSINESS_ID,
    name: SITE_NAME,
    legalName: NAP.legalName,
    description: NAP.description,
    url: SITE_URL,
    image: LOGO_URL,
    logo: LOGO_URL,
    telephone: NAP.telephone,
    email: NAP.email,
    priceRange: NAP.priceRange,
    address: postalAddress,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: NAP.geo.latitude,
      longitude: NAP.geo.longitude,
    },
    areaServed: NAP.areaServed.map((name) => ({
      '@type': 'AdministrativeArea',
      name,
    })),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [...NAP.openingHours.days],
        opens: NAP.openingHours.opens,
        closes: NAP.openingHours.closes,
      },
    ],
    sameAs: [...SOCIALS],
    parentOrganization: { '@id': ORG_ID },
  };
}

export type FaqItem = { question: string; answer: string };

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function serviceSchema(opts: {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
  areaServed?: readonly string[];
  audience?: readonly string[];
  offers?: Record<string, unknown>[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    serviceType: opts.serviceType || opts.name,
    url: absoluteUrl(opts.url),
    provider: { '@id': ORG_ID },
    areaServed: (opts.areaServed ?? NAP.areaServed).map((name) => ({
      '@type': 'AdministrativeArea',
      name,
    })),
    ...(opts.audience
      ? { audience: opts.audience.map((name) => ({ '@type': 'Audience', audienceType: name })) }
      : {}),
    ...(opts.offers ? { offers: opts.offers } : {}),
  };
}

export function articleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  image: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    image: /^https?:/.test(opts.image) ? opts.image : absoluteUrl(opts.image),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(opts.url) },
    author: opts.author
      ? opts.author === SITE_NAME
        ? { '@id': ORG_ID }
        : { '@type': 'Person', name: opts.author }
      : { '@id': PERSON_ID },
    publisher: { '@id': ORG_ID },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    dateModified: opts.dateModified || opts.datePublished,
  };
}

export function aboutPageSchema(opts: { url: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: absoluteUrl(opts.url),
    description: opts.description,
    about: { '@id': ORG_ID },
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export function contactPageSchema(opts: { url: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    url: absoluteUrl(opts.url),
    description: opts.description,
    about: { '@id': LOCALBUSINESS_ID },
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export type Crumb = { name: string; url: string };

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.url),
    })),
  };
}

/**
 * CollectionPage (optionally a Blog) for the journal hub and publication pages.
 * `blog: true` types it as a Blog with blogPost entries (used by publications).
 */
export function collectionPageSchema(opts: {
  name: string;
  description: string;
  url: string;
  blog?: boolean;
  posts?: { name: string; url: string; datePublished?: string }[];
}) {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': opts.blog ? ['CollectionPage', 'Blog'] : 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.url),
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORG_ID },
  };
  if (opts.posts?.length) {
    node[opts.blog ? 'blogPost' : 'hasPart'] = opts.posts.map((p) => ({
      '@type': opts.blog ? 'BlogPosting' : 'WebPage',
      headline: p.name,
      name: p.name,
      url: absoluteUrl(p.url),
      ...(p.datePublished ? { datePublished: p.datePublished } : {}),
    }));
  }
  return node;
}

/**
 * Review nodes for the testimonials shown on a page (homepage). Each references
 * the Organization via itemReviewed @id, so the graph ties the review to the
 * entity. Emit ONLY on pages where the review text is visible, so the visible
 * copy and the structured data never drift. `who` = author, `p` = review body.
 */
export function reviewSchema(reviews: readonly { who: string; p: string }[]) {
  return reviews.map((r) => ({
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: { '@id': ORG_ID },
    author: { '@type': 'Person', name: r.who },
    reviewBody: r.p,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: 5,
      bestRating: 5,
      worstRating: 1,
    },
  }));
}

export function itemListSchema(opts: {
  name: string;
  items: { name: string; url: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.name,
    itemListElement: opts.items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.url),
    })),
  };
}
