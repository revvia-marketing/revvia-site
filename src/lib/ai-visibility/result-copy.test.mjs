import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assistantLabel, footerAnswerCount } from './result-copy.mjs';

describe('result copy', () => {
  it('capitalizes provider names', () => {
    assert.equal(assistantLabel('chatgpt'), 'ChatGPT');
    assert.equal(assistantLabel('perplexity'), 'Perplexity');
    assert.equal(assistantLabel('claude'), 'Claude');
  });

  it('counts only assistants that answered', () => {
    assert.equal(footerAnswerCount({
      chatgpt: { status: 'error', named: null },
      perplexity: { status: 'error', named: null },
      claude: { status: 'ok', named: 0 },
    }), 8);
    assert.equal(footerAnswerCount({
      chatgpt: { status: 'ok', named: 2 },
      perplexity: { status: 'ok', named: 1 },
      claude: { status: 'ok', named: 0 },
    }), 24);
  });

  it('the page footer and the email line use the live wording', () => {
    const page = JSON.parse(readFileSync(new URL('../../content/ai-visibility/page.json', import.meta.url), 'utf8'));
    assert.equal(page.messageMatchLine, 'This check asks all three, live.');
    assert.match(page.check.honesty, /\{answers\} answers/);
    assert.doesNotMatch(page.check.honesty, /24 answers/);
    const src = readFileSync(new URL('../../scripts/ai-visibility.js', import.meta.url), 'utf8');
    assert.match(src, /footerAnswerCount/);
    assert.match(src, /assistantLabel/);
  });
});
