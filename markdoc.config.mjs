import { defineMarkdocConfig, component } from '@astrojs/markdoc/config';

/**
 * Markdoc config for CMS body content. Exposes a `barchart` tag so case-study
 * authors can drop a revenue chart inline, and a `figure` tag (paired with the
 * Keystatic "Figure" content component) for images that float left/right with
 * text wrapping, or run full width. Standard prose is styled by `.prose`.
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
    figure: {
      render: component('./src/components/Figure.astro'),
      selfClosing: true,
      attributes: {
        src: { type: String, required: true },
        align: { type: String, default: 'left', matches: ['left', 'right', 'full'] },
        caption: { type: String },
      },
    },
  },
});
