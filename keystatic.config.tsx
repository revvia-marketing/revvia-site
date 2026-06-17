import { config, fields, collection } from '@keystatic/core';

/**
 * Keystatic CMS — admin UI at /keystatic.
 *
 * Storage: GitHub mode in production (editors publish straight to the repo,
 * which triggers a Netlify rebuild). Local mode in `astro dev` so you can edit
 * without GitHub credentials. Point `repo` at the real GitHub repository and
 * complete the GitHub App connect flow at /keystatic the first time.
 */
const repo = (import.meta.env.PUBLIC_KEYSTATIC_REPO as string) || 'revvia/revvia-site';
const [owner, name] = repo.split('/');

const SERIES = [
  { label: "Founder's Notes", value: 'founders-notes' },
  { label: 'Built in San Diego', value: 'built-in-san-diego' },
  { label: 'Coastal Drop Founders', value: 'coastal-drop-founders' },
] as const;

export default config({
  storage: import.meta.env.DEV
    ? { kind: 'local' }
    : { kind: 'github', repo: { owner: owner ?? 'revvia', name: name ?? 'revvia-site' } },
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
        body: fields.markdoc({ label: 'Body' }),
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
            fromLabel: fields.text({ label: 'From — label' }),
            fromValue: fields.text({ label: 'From — value' }),
            delta: fields.text({ label: 'Delta (gradient figure, e.g. 3.2×)' }),
            toLabel: fields.text({ label: 'To — label' }),
            toValue: fields.text({ label: 'To — value' }),
            toSub: fields.text({ label: 'To — sub' }),
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
