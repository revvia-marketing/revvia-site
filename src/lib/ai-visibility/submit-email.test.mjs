import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { completeEmailSubmit } from './submit-email.mjs';

describe('email submit redirect', () => {
  it('redirects after a successful post even when analytics throws', async () => {
    let redirected = 0;
    const ok = await completeEmailSubmit({
      post: async () => ({ ok: true }),
      onAnalytics: () => {
        throw new Error('gtag failed');
      },
      redirect: () => { redirected += 1; },
    });
    assert.equal(ok.ok, true);
    assert.equal(redirected, 1);
  });

  it('does not redirect when the post fails', async () => {
    let redirected = 0;
    const hung = await completeEmailSubmit({
      post: async () => { throw new Error('timeout'); },
      onAnalytics: () => { redirected += 1; },
      redirect: () => { redirected += 1; },
    });
    assert.equal(hung.ok, false);
    assert.equal(redirected, 0);
  });

  it('the check page posts the form before analytics and still assigns the thanks URL', () => {
    const source = readFileSync(new URL('../../scripts/ai-visibility.js', import.meta.url), 'utf8');
    const submit = source.slice(source.indexOf("form.addEventListener('submit'"));
    assert.ok(submit.indexOf('completeEmailSubmit') < submit.indexOf("window.location.assign(thanks)"));
    assert.match(submit, /onAnalytics:/);
    assert.equal(submit.includes('check@revvia.com'), false);
  });
});
