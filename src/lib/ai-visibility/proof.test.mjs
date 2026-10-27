import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { googleProofLine } from './content.mjs';

describe('googleProofLine', () => {
  it('includes the confirmed rating and review count', () => {
    assert.equal(googleProofLine('4.9', '28'), '4.9 stars from 28 Google reviews');
  });

  it('omits a count that has not been confirmed', () => {
    assert.equal(googleProofLine('4.9', ''), '4.9 Google rating');
    assert.equal(googleProofLine('', '28'), '');
  });
});
