import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCheckInput, prefillFromQuery, normalizeWebsite } from './validate.mjs';

describe('validateCheckInput', () => {
  it('accepts a normal step-1 payload and adds https', () => {
    const res = validateCheckInput({
      business: 'Harbor Plumbing',
      city: 'Mesa, AZ',
      trade: 'Plumbing',
      website: 'harborplumbing.example',
    });
    assert.equal(res.ok, true);
    assert.equal(res.value.website.startsWith('https://harborplumbing.example'), true);
  });

  it('rejects a script and a URL in the name and city', () => {
    const res = validateCheckInput({
      business: '<script>alert(1)</script>',
      city: 'https://evil.test',
      trade: 'Plumbing',
    });
    assert.equal(res.ok, false);
    assert.ok(res.fields.business);
    assert.ok(res.fields.city);
  });

  it('rejects an unknown trade', () => {
    const res = validateCheckInput({ business: 'Acme', city: 'Mesa, AZ', trade: 'Law' });
    assert.equal(res.ok, false);
    assert.ok(res.fields.trade);
  });

  it('clears the website when the visitor has none', () => {
    const res = validateCheckInput({
      business: 'Acme Co',
      city: 'Mesa, AZ',
      trade: 'HVAC',
      website: 'not a url',
      noWebsite: true,
    });
    assert.equal(res.ok, true);
    assert.equal(res.value.website, '');
  });
});

describe('prefillFromQuery', () => {
  it('fills matching fields and drops a script trade', () => {
    assert.deepEqual(
      prefillFromQuery({ business: 'Harbor Plumbing', city: 'Mesa, AZ', trade: 'plumbing' }),
      { business: 'Harbor Plumbing', city: 'Mesa, AZ', trade: 'Plumbing' }
    );
    assert.equal(prefillFromQuery({ trade: '<script>' }).trade, '');
    assert.equal(prefillFromQuery({ business: 'https://x.test' }).business, '');
  });
});

describe('normalizeWebsite', () => {
  it('rejects junk', () => {
    assert.equal(normalizeWebsite('not a url'), null);
    assert.equal(normalizeWebsite(''), '');
  });
});
