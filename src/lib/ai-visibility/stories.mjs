/**
 * Public client-story guardrails.
 * Results on the AI Visibility page are percentages or multiples only.
 * Dollar figures, raw counts, and a few client-specific phrases are rejected
 * so a case-study stat cannot be copied onto this page by accident.
 */

const METRIC = /^(?:\+?\d+(?:\.\d+)?%|\d+(?:\.\d+)?[×x])$/;

const GLOBAL_BANS = [
  { re: /\$/, reason: 'dollar figure' },
  { re: /\b24\/7\b/i, reason: '24/7' },
  { re: /ad spend stayed flat/i, reason: 'ad spend stayed flat' },
  { re: /\bnew patients?\b/i, reason: 'patient count' },
  { re: /\bpatients? (a|per) week\b/i, reason: 'patient count' },
  { re: /\bcheap\b/i, reason: 'price language' },
  { re: /\baffordable\b/i, reason: 'price language' },
  { re: /\bdiscount\b/i, reason: 'price language' },
  { re: /\bdeal\b/i, reason: 'price language' },
  { re: /#1\b/, reason: 'ranking claim' },
];

function textOf(story) {
  return [story.client, story.tradeLabel, story.location, story.metric, story.summary, story.footnote, story.linkLabel]
    .filter(Boolean)
    .join('\n');
}

export function storyProblems(story) {
  const problems = [];
  const metric = String(story.metric || '').trim();
  if (metric && !METRIC.test(metric)) {
    problems.push(`metric must be a percentage or multiple (got ${JSON.stringify(metric)})`);
  }
  const blob = textOf(story);
  for (const ban of GLOBAL_BANS) {
    if (ban.re.test(blob)) problems.push(ban.reason);
  }
  if (story.client === 'Peter Grimm') {
    const summary = `${story.summary || ''}\n${story.footnote || ''}`;
    if (!/ads-led/i.test(summary)) problems.push('Peter Grimm must say the result is ads-led');
    if (!/not AI visibility/i.test(summary)) problems.push('Peter Grimm must not be framed as an AI-visibility result');
    if (story.engagementType !== 'ads-led') problems.push('Peter Grimm engagementType must be ads-led');
  }
  if (story.client === 'Drain Mob' && metric && !metric.includes('%')) {
    problems.push('Drain Mob metric must be a percentage');
  }
  return problems;
}

export function assertStories(stories) {
  const errors = [];
  for (const story of stories) {
    const problems = storyProblems(story);
    if (problems.length) errors.push(`${story.client}: ${problems.join('; ')}`);
  }
  if (errors.length) {
    throw new Error(`Client story guardrails failed:\n${errors.join('\n')}`);
  }
}

/** Qualitative when there is no compliant number to show. */
export function isQualitative(story) {
  return !String(story.metric || '').trim();
}
