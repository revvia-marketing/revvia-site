import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAnswers } from './score.mjs';

const questions = [0, 1];

function row(assistant, questionIndex, text, extra = {}) {
  return { assistant, questionIndex, text, citations: [], error: null, ...extra };
}

describe('scoreAnswers', () => {
  it('counts a question when any assistant names the business', () => {
    const result = scoreAnswers({
      business: 'Harbor Plumbing Co.',
      website: '',
      questionCount: 2,
      answers: [
        row('chatgpt', 0, 'Harbor Plumbing is the one.'),
        row('chatgpt', 1, 'Someone else.'),
        row('perplexity', 0, 'No mention.'),
        row('perplexity', 1, 'Harbor Plumbing again.'),
        row('claude', 0, 'No.'),
        row('claude', 1, 'No.'),
      ],
    });
    assert.equal(result.namedCount, 2);
    assert.equal(result.byAssistant.chatgpt.named, 1);
    assert.equal(result.byAssistant.perplexity.named, 1);
    assert.equal(result.byAssistant.claude.named, 0);
    assert.equal(result.assistantsOk, 3);
  });

  it('marks a failed assistant not available and never 0', () => {
    const result = scoreAnswers({
      business: 'Harbor Plumbing',
      website: '',
      questionCount: questions.length,
      answers: [
        row('chatgpt', 0, 'Harbor Plumbing.'),
        row('chatgpt', 1, 'Harbor Plumbing.'),
        row('perplexity', 0, '', { error: 'timeout' }),
        row('perplexity', 1, 'unused'),
        row('claude', 0, 'nope'),
        row('claude', 1, 'nope'),
      ],
    });
    assert.equal(result.byAssistant.perplexity.status, 'error');
    assert.equal(result.byAssistant.perplexity.named, null);
    assert.notEqual(result.byAssistant.perplexity.named, 0);
    assert.equal(result.namedCount, 2);
    assert.deepEqual(result.failedAssistants, ['perplexity']);
  });

  it('counts a domain citation as named', () => {
    const result = scoreAnswers({
      business: 'Harbor Plumbing',
      website: 'https://harborplumbing.example',
      questionCount: 1,
      answers: [
        row('chatgpt', 0, 'A few companies.', { citations: ['https://harborplumbing.example/a'] }),
        row('perplexity', 0, 'Others.'),
        row('claude', 0, 'Others.'),
      ],
    });
    assert.equal(result.namedCount, 1);
    assert.equal(result.byAssistant.chatgpt.named, 1);
  });
});
