import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchMention, normalize, domainOf } from './match.mjs';

describe('normalize', () => {
  it('folds ampersands, punctuation, and company suffixes', () => {
    assert.equal(normalize('A&B Electric'), 'a and b electric');
    assert.equal(normalize('Harbor Plumbing Co.'), 'harbor plumbing');
    assert.equal(normalize('The Harbor Plumbing, LLC'), 'harbor plumbing');
    assert.equal(normalize('Harbor Plumbing, Inc.'), 'harbor plumbing');
  });
});

describe('matchMention', () => {
  const biz = 'Harbor Plumbing Co.';

  it('names an exact phrase', () => {
    assert.equal(matchMention({ business: biz, text: 'Call Harbor Plumbing today.' }), 'named');
  });

  it('names Harbor Plumbing Co. when the answer says Harbor Plumbing', () => {
    assert.equal(matchMention({ business: biz, text: 'Harbor Plumbing is who locals call.' }), 'named');
  });

  it('names A&B Electric when the answer says A and B Electric', () => {
    assert.equal(
      matchMention({ business: 'A&B Electric', text: 'A and B Electric serves the city.' }),
      'named'
    );
  });

  it('names a domain-only mention in the answer', () => {
    assert.equal(
      matchMention({
        business: biz,
        website: 'https://www.harborplumbing.example',
        text: 'See harborplumbing.example for hours.',
      }),
      'named'
    );
  });

  it('names a domain that appears only in citations', () => {
    assert.equal(
      matchMention({
        business: biz,
        website: 'harborplumbing.example',
        text: 'Several plumbers were mentioned.',
        citations: ['https://harborplumbing.example/services'],
      }),
      'named'
    );
  });

  it('marks a different business that shares one word as possible, not named', () => {
    assert.equal(
      matchMention({ business: biz, text: 'Harbor Electric is the one I would call.' }),
      'possible'
    );
  });

  it('does not name a completely different business', () => {
    assert.equal(matchMention({ business: biz, text: 'Summit Roofing has the best reviews.' }), 'none');
  });

  it('names a case and punctuation variant', () => {
    assert.equal(matchMention({ business: biz, text: 'HARBOR PLUMBING!' }), 'named');
  });

  it('drops a leading The', () => {
    assert.equal(
      matchMention({ business: 'The Harbor Plumbing', text: 'harbor plumbing did the job' }),
      'named'
    );
  });

  it('treats a close spelling as possible, not named', () => {
    assert.equal(matchMention({ business: biz, text: 'Harbor Plumbng fixed our heater.' }), 'possible');
  });

  it('treats reversed word order as possible, not named', () => {
    assert.equal(
      matchMention({ business: biz, text: 'For plumbing, Harbor is one option among many.' }),
      'possible'
    );
  });

  it('ignores an empty answer with no domain', () => {
    assert.equal(matchMention({ business: biz, text: '' }), 'none');
  });

  it('parses a website domain', () => {
    assert.equal(domainOf('https://www.Example.com/path'), 'example.com');
    assert.equal(domainOf(''), '');
  });
});
