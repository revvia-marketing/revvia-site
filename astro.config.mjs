// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Canonical production URL. Override with PUBLIC_SITE_URL if the host changes.
const SITE = process.env.PUBLIC_SITE_URL || 'https://revvia.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  // Static-first. Keystatic's admin + API routes opt into on-demand rendering
  // via the Netlify adapter; every content page is prerendered to static HTML.
  output: 'static',
  adapter: netlify(),
  // 301s from the old Wix URLs → clean routes (emitted into Netlify _redirects).
  redirects: {
    '/our-story': '/about',
    '/team': '/about',
    '/fractionalcmo': '/services',
    '/singleservices': '/services',
    '/digitaladvertising': '/services',
    '/seo-services': '/services',
    '/customwebsites': '/services',
    '/marketingsetupguide': '/services',
    '/builtinsd': '/journal/built-in-san-diego',
    '/westcoastdtc': '/journal/west-coast-dtc',
    '/journal/coastal-drop-founders': '/journal/west-coast-dtc',
    // Old Wix /post/ URLs for the migrated Built in San Diego features.
    '/post/she-asked-meta-s-engineers-if-their-a-i-was-safe-their-answer-became-a-company':
      '/journal/magier-ai',
    '/post/he-knew-nothing-about-plants-nothing-about-greenwalls-nothing-about-america-he-built-a-national-b':
      '/journal/growup-greenwalls',
    '/post/the-architect-who-asks-what-if-it-was-better-than-you-imagined':
      '/journal/kuhlman-scott-architects',
    '/post/he-left-the-hospital-to-give-you-something-most-doctors-can-t-time':
      '/journal/coastal-internal-medicine',
    // Remaining old Wix URLs still indexed in Search Console. Any other
    // /post/* falls through to the catch-all in netlify.toml.
    '/blog': '/journal/',
    '/post/how-a-family-s-love-of-the-water-built-one-of-north-county-s-most-trusted-boat-shops':
      '/journal/built-in-san-diego/',
    '/post/the-fixer-how-david-hirschfeld-built-a-career-out-of-solving-problems-nobody-else-could-see':
      '/journal/built-in-san-diego/',
    '/post/meet-tim-holt-of-revvia-digital-marketing-expert': '/about/',
    '/post/a-beginner-s-guide-to-understanding-aerial-photography-services': '/work/photography/',
    '/book-online': '/contact/',
    '/adsconnect': '/services/',
    '/adsconnect-1': '/services/',
    '/seoconnect': '/services/',
    '/faq': '/#faq',
    // EverSun case study removed - keep the old URL from 404ing.
    '/work/eversun': '/work',
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  image: {
    // Allow Astro's image pipeline to optimise everything we ship.
    domains: [],
  },
  integrations: [
    react(),
    markdoc(),
    mdx(),
    keystatic(),
    sitemap({
      // Keep the CMS admin + API and OG endpoint out of the public sitemap.
      filter: (page) =>
        !page.includes('/keystatic') &&
        !page.includes('/api/') &&
        !page.includes('/og-') &&
        !page.includes('/ai-visibility/thanks') &&
        // Lead-magnet confirmation pages + the guide are noindex.
        !page.includes('/real-cost/thanks') &&
        !page.includes('/scorecard/results') &&
        !page.includes('/ai-snapshot/thanks') &&
        !page.includes('/guides/'),
    }),
  ],
});
