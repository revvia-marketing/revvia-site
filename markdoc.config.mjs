import { defineMarkdocConfig, component } from '@astrojs/markdoc/config';

/**
 * Markdoc config for CMS body content. Exposes a `barchart` tag so case-study
 * authors can drop a revenue chart inline, and a `takeaway` tag for the big
 * closing quote. Standard prose (headings, lists, blockquotes) is styled by
 * the page's `.article` container.
 */
export default defineMarkdocConfig({
  tags: {
    barchart: {
      render: component('./src/components/Barchart.astro'),
      attributes: {
        title: { type: String },
        legend: { type: Boolean, default: false },
        axisLeft: { type: String },
        axisRight: { type: String },
        bars: { type: Array },
      },
    },
  },
});
