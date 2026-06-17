/**
 * JSON-LD builders. Every page composes the structured-data types the spec
 * requires by calling these helpers, so the shapes stay consistent and valid.
 * Returned objects are injected by <SchemaJsonLd /> (no @context duplication —
 * each top-level node carries its own).
 */
import {
  SITE_URL,
  SITE_NAME,
  NAP,
  SOCIALS,
  DEFAULT_DESCRIPTION,
  absoluteUrl,
} from './site';

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const LOCALBUSINESS_ID = `${SITE_URL}/#localbusiness`;
const LOGO_URL = absoluteUrl('/og/revvia-logo.png');

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
    sameAs: [...SOCIALS],
  };
}

/** Sitewide WebSite node with a SearchAction potentialAction. */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/journal?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * LocalBusiness / ProfessionalService — used on Home, About, Contact.
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
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    serviceType: opts.serviceType || opts.name,
    url: absoluteUrl(opts.url),
    provider: { '@id': ORG_ID },
    areaServed: NAP.areaServed.map((name) => ({
      '@type': 'AdministrativeArea',
      name,
    })),
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
    author: { '@type': 'Person', name: opts.author || 'Tim Holt' },
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
