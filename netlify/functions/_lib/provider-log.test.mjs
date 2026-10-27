import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeProviderFailure } from './provider-log.mjs';

function fakeKey() {
  return ['sk', 'test', 'fake'].join('-') + 'x'.repeat(24);
}

describe('safeProviderFailure', () => {
  it('keeps status and error type and strips keys, emails, and the prompt', () => {
    const question = 'Who fixes drains in San Diego? Ask pat@shop.test';
    const key = fakeKey();
    const failure = safeProviderFailure({
      provider: 'perplexity',
      model: 'sonar',
      question,
      err: {
        name: 'Error',
        status: 404,
        message: `http 404 ${question}`,
        body: {
          error: {
            type: 'not_found',
            message: `missing route for owner@drain.test key ${key}`,
          },
        },
      },
    });
    const dumped = JSON.stringify(failure);
    assert.equal(failure.provider, 'perplexity');
    assert.equal(failure.model, 'sonar');
    assert.equal(failure.status, 404);
    assert.equal(failure.error, 'not_found');
    assert.equal(dumped.includes('pat@shop.test'), false);
    assert.equal(dumped.includes('owner@drain.test'), false);
    assert.equal(dumped.includes(key), false);
    assert.equal(dumped.includes('Who fixes drains'), false);
    assert.match(failure.body, /\[redacted-email\]/);
    assert.match(failure.body, /\[redacted-key\]/);
    assert.ok(failure.body.length <= 500);
  });

  it('labels an abort as a timeout and does not invent a status', () => {
    const failure = safeProviderFailure({
      provider: 'chatgpt',
      model: 'gpt-6.1-sol',
      question: 'Who should I call for a plumber in San Diego today?',
      err: { name: 'TimeoutError', message: 'The operation was aborted due to timeout' },
    });
    assert.equal(failure.error, 'timeout');
    assert.equal(failure.status, null);
    assert.equal(failure.model, 'gpt-6.1-sol');
  });
});
