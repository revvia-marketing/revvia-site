import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderQuestion, TEMPLATES } from './questions.mjs';

describe('renderQuestion', () => {
  it('fills pro, trade, job, and city', () => {
    const text = renderQuestion(TEMPLATES[0], {
      pro: 'plumber',
      tradeNoun: 'plumbing',
      job: 'a water heater replacement',
      city: 'Mesa, AZ',
    });
    assert.equal(text, 'Who is the best plumber in Mesa, AZ?');
  });

  it('can leave {city} literal for the methodology page', () => {
    const text = renderQuestion(
      TEMPLATES[4],
      { pro: 'roofer', tradeNoun: 'roofing', job: 'a roof leak repair', city: 'Mesa, AZ' },
      { literalCity: true }
    );
    assert.equal(text, 'Who should I call for a roof leak repair in {city}?');
  });

  it('ships exactly 8 templates', () => {
    assert.equal(TEMPLATES.length, 8);
  });
});
