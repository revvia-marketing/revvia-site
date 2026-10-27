import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { storyProblems, assertStories } from './stories.mjs';

const dir = new URL('../../content/stories/', import.meta.url);

describe('seeded client stories', () => {
  const stories = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8')));

  it('passes the guardrails', () => {
    assert.doesNotThrow(() => assertStories(stories));
    assert.equal(stories.length, 4);
  });

  it('keeps Steady Builders and Coastal qualitative', () => {
    const steady = stories.find((s) => s.client === 'Steady Builders');
    const coastal = stories.find((s) => s.client === 'Coastal Internal Medicine');
    assert.equal(steady.metric, '');
    assert.equal(coastal.metric, '');
    assert.match(steady.summary, /ChatGPT/);
    assert.doesNotMatch(coastal.summary + coastal.footnote, /patient/i);
  });

  it('rejects a dollar figure, a raw patient count, 24/7, and a flat-spend claim', () => {
    assert.ok(storyProblems({ client: 'Steady Builders', summary: 'Revenue hit $1M.' }).length);
    assert.ok(storyProblems({ client: 'Coastal Internal Medicine', summary: '3 or more new patients per week from ChatGPT' }).length);
    assert.ok(storyProblems({ client: 'Drain Mob', summary: 'Open 24/7.', metric: '+33%' }).length);
    assert.ok(storyProblems({ client: 'Peter Grimm', summary: 'Ad spend stayed flat.', metric: '3.6×', engagementType: 'ads-led' }).length);
    assert.ok(storyProblems({ client: 'Peter Grimm', summary: '3.6× from AI visibility.', metric: '3.6×', engagementType: 'ads-led' }).length);
  });
});
