import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  openAiAnswer,
  openAiBody,
  perplexityAnswer,
  perplexityResponsesBody,
  retiredSonarError,
  PERPLEXITY_RESPONSES_URL,
} from './assistants.mjs';

describe('assistant request shapes', () => {
  it('asks OpenAI with web_search, low effort, and an approximate location', () => {
    const body = openAiBody({ model: 'gpt-6.1-sol', question: 'Who should I call?', city: 'San Diego, CA' });
    assert.equal(body.model, 'gpt-6.1-sol');
    assert.equal(body.reasoning.effort, 'low');
    assert.equal(body.tools[0].type, 'web_search');
    assert.equal(body.tools[0].search_context_size, 'low');
    assert.deepEqual(body.tools[0].user_location, {
      type: 'approximate',
      country: 'US',
      city: 'San Diego',
      region: 'CA',
    });
  });

  it('posts Sonar as an effort preset to /v1/responses and does not send that model id', () => {
    const body = perplexityResponsesBody({ model: 'sonar', question: 'Who should I call?', city: 'San Diego' });
    assert.equal(PERPLEXITY_RESPONSES_URL, 'https://api.perplexity.ai/v1/responses');
    assert.equal(body.effort, 'fast');
    assert.equal(body.model, undefined);
    assert.equal(body.input, 'Who should I call?');
    assert.equal('messages' in body, false);
    assert.equal(body.tools[0].type, 'web_search');
    assert.deepEqual(body.tools[0].user_location, { country: 'US', city: 'San Diego' });
    assert.equal('region' in body.tools[0].user_location, false);

    const located = perplexityResponsesBody({ model: 'sonar', question: 'Who should I call?', city: 'Mesa, AZ' });
    assert.equal(located.tools[0].user_location.region, 'AZ');

    const direct = perplexityResponsesBody({ model: 'openai/gpt-5.6-sol', question: 'Who?', city: 'San Diego' });
    assert.equal(direct.model, 'openai/gpt-5.6-sol');
    assert.equal(direct.effort, undefined);
    assert.equal(direct.tools[0].type, 'web_search');

    assert.equal(retiredSonarError({
      status: 403,
      body: { error: { type: 'chat_completions_not_available', message: 'Sonar is now the Agent API.' } },
    }), true);
    assert.equal(retiredSonarError({ status: 404, body: { error: { type: 'not_found' } } }), false);
  });
});

describe('assistant response parsing', () => {
  it('reads OpenAI output_text and citation urls from the output array', () => {
    const parsed = openAiAnswer({
      model: 'gpt-6.1-sol',
      output_text: 'Drain Mob is the one to call.',
      output: [{
        type: 'message',
        content: [{
          type: 'output_text',
          text: 'ignored because output_text is set',
          annotations: [{ type: 'url_citation', url: 'https://drainmob.example/services' }],
        }],
      }],
    }, 'gpt-6.1-sol');
    assert.equal(parsed.text, 'Drain Mob is the one to call.');
    assert.deepEqual(parsed.citations, ['https://drainmob.example/services']);
    assert.equal(parsed.error, null);
  });

  it('joins OpenAI output parts when output_text is missing', () => {
    const parsed = openAiAnswer({
      output: [{
        type: 'message',
        content: [
          { type: 'output_text', text: 'First.' },
          { type: 'output_text', text: 'Second.' },
        ],
      }],
    }, 'gpt-6.1-sol');
    assert.equal(parsed.text, 'First.\nSecond.');
  });

  it('reads Perplexity choices, citations, and search_results', () => {
    const parsed = perplexityAnswer({
      model: 'sonar',
      choices: [{ message: { content: 'A local plumber.' } }],
      citations: ['https://example.com/a'],
      search_results: [{ title: 'Listing', url: 'https://example.com/b' }],
    }, 'sonar');
    assert.equal(parsed.text, 'A local plumber.');
    assert.deepEqual(parsed.citations, ['https://example.com/a', 'https://example.com/b']);
  });

  it('reads an Agent API output_text when there is no chat choice', () => {
    const parsed = perplexityAnswer({
      output_text: 'From the agent.',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'not used' }] }],
    }, 'fast');
    assert.equal(parsed.text, 'From the agent.');
  });

  it('reads Agent API message text and search_results citations', () => {
    const parsed = perplexityAnswer({
      model: 'openai/gpt-5.6-luna',
      output: [
        {
          type: 'search_results',
          results: [{ id: 1, title: 'Listing', url: 'https://example.com/a' }],
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'output_text',
            text: 'A local plumber.',
            annotations: [{ type: 'url_citation', url: 'https://example.com/b' }],
          }],
        },
      ],
    }, 'fast');
    assert.equal(parsed.text, 'A local plumber.');
    assert.deepEqual(parsed.citations, ['https://example.com/a', 'https://example.com/b']);
    assert.equal(parsed.model, 'openai/gpt-5.6-luna');
    assert.equal(parsed.error, null);
  });
});
