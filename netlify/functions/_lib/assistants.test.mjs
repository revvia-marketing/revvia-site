import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  openAiAnswer,
  openAiBody,
  perplexityAnswer,
  perplexitySonarBody,
  perplexityAgentBody,
  PERPLEXITY_SONAR_URL,
  PERPLEXITY_AGENT_URL,
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

  it('posts Sonar to /v1/sonar and does not send that model id to the Agent API', () => {
    const sonar = perplexitySonarBody({ model: 'sonar', question: 'Who should I call?', city: 'San Diego' });
    assert.equal(PERPLEXITY_SONAR_URL, 'https://api.perplexity.ai/v1/sonar');
    assert.equal(sonar.model, 'sonar');
    assert.deepEqual(sonar.messages, [{ role: 'user', content: 'Who should I call?' }]);
    assert.deepEqual(sonar.web_search_options.user_location, { country: 'US', city: 'San Diego' });
    assert.equal('region' in sonar.web_search_options.user_location, false);

    const agent = perplexityAgentBody({ question: 'Who should I call?', city: 'Mesa, AZ' });
    assert.equal(PERPLEXITY_AGENT_URL, 'https://api.perplexity.ai/v1/agent');
    assert.equal(agent.model, undefined);
    assert.equal(agent.effort, 'fast');
    assert.equal(agent.input, 'Who should I call?');
    assert.equal(agent.tools[0].type, 'web_search');
    assert.equal(agent.tools[0].user_location.region, 'AZ');
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
    }, 'sonar');
    assert.equal(parsed.text, 'From the agent.');
  });
});
