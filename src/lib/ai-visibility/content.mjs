import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fillTree } from './copy.mjs';
import { assertStories, isQualitative } from './stories.mjs';
import { instantCheckEnabled, showUnverifiedReviews, stripeHref } from './env.mjs';
import { renderQuestion } from './questions.mjs';

const contentRoot = join(process.cwd(), 'src/content');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readDir(name) {
  const dir = join(contentRoot, name);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson(join(dir, file)))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function storyMeta(story) {
  return [story.tradeLabel, story.location].filter(Boolean).join(' · ');
}

export function loadAiVisibility(env = process.env) {
  const page = readJson(join(contentRoot, 'ai-visibility/page.json'));
  const proof = readJson(join(contentRoot, 'ai-visibility/site-proof.json'));
  const methodology = readJson(join(contentRoot, 'ai-visibility/methodology.json'));
  const reviews = readDir('reviews');
  const stories = readDir('stories');
  const plans = readDir('ai-visibility-plans');
  const questions = readDir('check-questions');
  assertStories(stories);

  const instant = instantCheckEnabled(env);
  const preview = showUnverifiedReviews(env);
  const copy = fillTree(page, {
    instant,
    instantTurnaround: page.instantTurnaround,
    checkTurnaround: page.checkTurnaround,
    setupDays: page.setupDays,
    primaryCtaLabel: page.primaryCtaLabel,
    primaryCtaShort: page.primaryCtaShort,
  });

  const rating = String(proof.googleRating || '').trim();
  const count = String(proof.googleReviewCount || '').trim();
  const url = String(proof.googleReviewsUrl || '').trim();
  const visibleReviews = reviews
    .filter((review) => review.show && (preview || review.verifiedOn))
    .map((review) => ({ ...review, unverified: Boolean(preview && !review.verifiedOn) }));

  return {
    instant,
    preview,
    copy,
    proof: rating && count && url ? { rating, count, url } : null,
    reviews: visibleReviews,
    pricingReview: visibleReviews.find((review) => review.showNearPricing) || null,
    stories: copy.showAgencyProof
      ? stories.filter((story) => story.show).map((story) => ({ ...story, qualitative: isQualitative(story), meta: storyMeta(story) }))
      : [],
    plans,
    monthlyPlans: plans.filter((plan) => plan.interval === 'month'),
    setupPlan: plans.find((plan) => plan.interval === 'once') || null,
    questions,
    methodology,
    stripe: {
      PUBLIC_STRIPE_LINK_KEEP: stripeHref('PUBLIC_STRIPE_LINK_KEEP', env),
      PUBLIC_STRIPE_LINK_GROW: stripeHref('PUBLIC_STRIPE_LINK_GROW', env),
    },
    renderQuestion,
  };
}
