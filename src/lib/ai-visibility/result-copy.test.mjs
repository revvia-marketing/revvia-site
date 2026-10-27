import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assistantLabel, footerAnswerCount, showReusedNote } from './result-copy.mjs';

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
    assert.match(src, /showReusedNote/);
  });

  it('shows the reused sentence only when every reused answer succeeded', () => {
    const ok = { status: 'ok', named: 1 };
    const failed = { status: 'error', named: null };
    assert.equal(showReusedNote({
      cached: true,
      failedAssistants: [],
      byAssistant: { chatgpt: ok, perplexity: ok, claude: ok },
    }), true);
    assert.equal(showReusedNote({
      cached: true,
      failedAssistants: ['chatgpt', 'perplexity'],
      byAssistant: { chatgpt: failed, perplexity: failed, claude: ok },
    }), false);
    assert.equal(showReusedNote({
      cached: false,
      failedAssistants: [],
      byAssistant: { chatgpt: ok, perplexity: ok, claude: ok },
    }), false);
  });
});
