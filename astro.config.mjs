// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Canonical production URL. Override with PUBLIC_SITE_URL if the host changes.
const SITE = process.env.PUBLIC_SITE_URL || 'https://www.revvia.com';

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
    '/faq': '/#faq',
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
        !page.includes('/og-'),
    }),
  ],
});
