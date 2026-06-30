import { config, fields, collection } from '@keystatic/core';
import { block } from '@keystatic/core/content-components';

/**
 * Keystatic CMS - admin UI at /keystatic.
 *
 * Storage: GitHub mode in production (editors publish straight to this repo,
 * which triggers a Netlify rebuild). Local mode in `astro dev` so you can edit
 * without GitHub credentials. GitHub-mode auth uses a GitHub App; its
 * credentials come from environment variables (see README → "Keystatic
 * GitHub mode"): KEYSTATIC_GITHUB_CLIENT_ID, KEYSTATIC_GITHUB_CLIENT_SECRET,
 * KEYSTATIC_SECRET, and PUBLIC_KEYSTATIC_GITHUB_APP_SLUG.
 */
const GITHUB_REPO = { owner: 'revvia-marketing', name: 'revvia-site' } as const;

const SERIES = [
  { label: "Founder's Notes", value: 'founders-notes' },
  { label: 'Built in San Diego', value: 'built-in-san-diego' },
  { label: 'West Coast DTC', value: 'west-coast-dtc' },
] as const;

export default config({
  storage: import.meta.env.DEV
    ? { kind: 'local' }
    : { kind: 'github', repo: GITHUB_REPO },
  ui: {
    brand: { name: 'Revvia' },
    navigation: {
      Content: ['journal', 'caseStudies'],
    },
  },
  collections: {
    journal: collection({
      label: 'Journal',
      slugField: 'title',
      path: 'src/content/journal/*',
      format: { contentField: 'body' },
      entryLayout: 'content',
      columns: ['title', 'series', 'date'],
      schema: {
        title: fields.slug({
          name: { label: 'Title', validation: { isRequired: true } },
          slug: {
            label: 'URL slug',
            description: 'The path segment under /journal/.',
          },
        }),
        series: fields.select({
          label: 'Series',
          options: SERIES as unknown as { label: string; value: string }[],
          defaultValue: 'founders-notes',
        }),
        date: fields.date({
          label: 'Publish date',
          defaultValue: { kind: 'today' },
          validation: { isRequired: true },
        }),
        excerpt: fields.text({
          label: 'Excerpt',
          multiline: true,
          validation: { isRequired: true, length: { max: 280 } },
        }),
        coverImage: fields.image({
          label: 'Cover image',
          description: 'Runs through Astro’s image pipeline. Optional.',
          directory: 'src/assets/journal',
          publicPath: '/src/assets/journal/',
        }),
        gallery: fields.array(
          fields.object({
            image: fields.image({
              label: 'Photo',
              directory: 'src/assets/journal',
              publicPath: '/src/assets/journal/',
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: 'Caption (optional)' }),
          }),
          {
            label: 'Photo gallery',
            description: 'Photos shown in a grid at the end of the article. Add as many as you like.',
            itemLabel: (props) => props.fields.caption.value || 'Photo',
          }
        ),
        body: fields.markdoc({
          label: 'Body',
          // Raw inline images are disabled (fragile in GitHub mode). In-article
          // photos go in via the Figure block (wrap left/right or full width)
          // or the Photo gallery field above.
          options: { image: false },
          components: {
            figure: block({
              label: 'Figure (image + text wrap)',
              schema: {
                src: fields.image({
                  label: 'Image',
                  directory: 'src/assets/journal',
                  publicPath: '/src/assets/journal/',
                  validation: { isRequired: true },
                }),
                align: fields.select({
                  label: 'Alignment',
                  options: [
                    { label: 'Left - text wraps on the right', value: 'left' },
                    { label: 'Right - text wraps on the left', value: 'right' },
                    { label: 'Full width', value: 'full' },
                  ],
                  defaultValue: 'left',
                }),
                caption: fields.text({ label: 'Caption (optional)' }),
              },
            }),
          },
        }),
        metaTitle: fields.text({ label: 'Meta title (SEO override)' }),
        metaDescription: fields.text({
          label: 'Meta description (SEO override)',
          multiline: true,
        }),
        ogImage: fields.image({
          label: 'OG image (SEO override)',
          directory: 'src/assets/journal',
          publicPath: '/src/assets/journal/',
        }),
      },
    }),

    caseStudies: collection({
      label: 'Case Studies',
      slugField: 'client',
      path: 'src/content/case-studies/*',
      format: { contentField: 'body' },
      entryLayout: 'content',
      columns: ['client', 'category'],
      schema: {
        client: fields.slug({
          name: { label: 'Client', validation: { isRequired: true } },
          slug: { label: 'URL slug', description: 'The path segment under /work/.' },
        }),
        category: fields.text({ label: 'Category', defaultValue: 'Photo + Video' }),
        eyebrow: fields.text({
          label: 'Hero eyebrow',
          description: 'e.g. "Heritage Headwear · Shopify · Carlsbad, CA"',
        }),
        summary: fields.text({
          label: 'Summary / lede',
          multiline: true,
          validation: { isRequired: true },
        }),
        transform: fields.object(
          {
            fromLabel: fields.text({ label: 'From - label' }),
            fromValue: fields.text({ label: 'From - value' }),
            delta: fields.text({ label: 'Delta (gradient figure, e.g. 3.2×)' }),
            toLabel: fields.text({ label: 'To - label' }),
            toValue: fields.text({ label: 'To - value' }),
            toSub: fields.text({ label: 'To - sub' }),
          },
          { label: 'Transform (before → after hero card)' }
        ),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' } }),
        coverImage: fields.image({
          label: 'Cover image',
          directory: 'src/assets/case-studies',
          publicPath: '/src/assets/case-studies/',
        }),
        stats: fields.array(
          fields.object({
            value: fields.text({ label: 'Value' }),
            label: fields.text({ label: 'Label', multiline: true }),
          }),
          { label: 'Stats', itemLabel: (props) => props.fields.value.value || 'Stat' }
        ),
        ctaHeading: fields.text({ label: 'Closing CTA heading' }),
        ctaLead: fields.text({ label: 'Closing CTA lead', multiline: true }),
        body: fields.markdoc({ label: 'Body' }),
        metaTitle: fields.text({ label: 'Meta title (SEO override)' }),
        metaDescription: fields.text({ label: 'Meta description (SEO override)', multiline: true }),
      },
    }),
  },
});
