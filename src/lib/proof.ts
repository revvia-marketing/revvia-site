/**
 * Single source of truth for published social proof - the testimonials and the
 * "Proof, not promises" result tiles shown on the homepage. The homepage and
 * the landing-page proof components both import from here so the copy can never
 * drift, and so nothing is retyped or paraphrased (honesty rule).
 *
 * Do NOT edit the wording here without updating the corresponding case study /
 * client approval - this is published, verified proof.
 */

export type Testimonial = { p: string; who: string; sub: string };

export const TESTIMONIALS: Testimonial[] = [
  { p: "Tim and his team 'get it,' and Revvia has worked intimately with our team and product to build strategic growth and follow our lead in brand recognition and more. Looking forward to a successful year together.", who: 'Jamie Cohen', sub: 'COO, Voyage Air Guitar' },
  { p: "We've been working with Tim and his team for over two years now, and it's been a great experience. They've helped us grow our social media following significantly and have done an awesome job keeping our content fresh and engaging. It really feels like they care about our business and want to see us succeed.", who: 'Aubrey Lancon', sub: 'COO, WOT Marine' },
  { p: "Working with Revvia has been one of the best decisions we've made for our marketing. What really sets them apart is that they don't just bring great ideas to the table - they also listen. It's refreshing to work with a marketing company that truly feels like an extension of our own team.", who: 'Sam Dobel', sub: 'Operations Manager, Drain Mob' },
];

export type ResultTile = { stat: string; label: string; href: string; name: string };

/** Keyed by case-study slug. Text is verbatim from the homepage work cards. */
export const RESULTS: Record<string, ResultTile> = {
  'steady-builders': {
    stat: '$1M+ in proposals',
    label: 'Attributed proposal-stage revenue in the first two months of advertising - from 25 years of word-of-mouth.',
    href: '/work/steady-builders',
    name: 'Steady Builders',
  },
  'coastal-internal-medicine': {
    stat: '#1 in AI + search',
    label: "Highest AI visibility of any North County internal medicine practice; #1 organic for 'internist Vista.'",
    href: '/work/coastal-internal-medicine',
    name: 'Coastal Internal Medicine',
  },
  'drain-mob': {
    stat: '+33% in June',
    label: 'Year-over-year revenue up in the month plumbing normally contracts.',
    href: '/work/drain-mob',
    name: 'Drain Mob',
  },
  'peter-grimm': {
    stat: '3.6×',
    label: 'Monthly revenue growth in six months - rebuilt mid-migration.',
    href: '/work/peter-grimm',
    name: 'Peter Grimm',
  },
};

/** Select tiles by slug, in the given order. */
export function resultTiles(include: string[]): ResultTile[] {
  return include.map((slug) => RESULTS[slug]).filter(Boolean);
}

/** Select testimonials by author name, in the given order (default: all). */
export function testimonials(include?: string[]): Testimonial[] {
  if (!include || include.length === 0) return TESTIMONIALS;
  return include
    .map((who) => TESTIMONIALS.find((t) => t.who === who))
    .filter((t): t is Testimonial => Boolean(t));
}
