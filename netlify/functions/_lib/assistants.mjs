/**
 * Official APIs only. Model names come from the environment.
 * No system prompt, no temperature override, no consumer apps, no Google.
 *
 * OpenAI: Responses API + web_search
 *   https://developers.openai.com/api/docs/guides/tools-web-search
 * Perplexity: Sonar chat completions at /v1/sonar (search is built in).
 * The old /chat/completions path was retired. If /v1/sonar is gone, one
 * follow-up uses the Agent API (effort, not the Sonar model id):
 * https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to
 * Anthropic: Messages API + web_search_20250305
 *   https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 */

function place(city) {
  const parts = String(city || '').split(',').map((part) => part.trim()).filter(Boolean);
  const cityName = parts[0] || String(city || '');
  const region = parts.length > 1 ? parts.slice(1).join(', ') : '';
  return { city: cityName, region, country: 'US' };
}

function openAiLocation(city) {
  const loc = place(city);
  const user_location = { type: 'approximate', country: loc.country, city: loc.city };
  if (loc.region) user_location.region = loc.region;
  return user_location;
}

function collectUrls(value, into) {
  if (!value) return;
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, into);
    return;
  }
  if (typeof value === 'object') {
    if (typeof value.url === 'string') into.push(value.url);
    for (const item of Object.values(value)) {
      if (item && typeof item === 'object') collectUrls(item, into);
    }
  }
}

async function postJson(url, { headers, body, signal }) {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw: raw.slice(0, 500) };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.message || `http ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export function openAiAnswer(data, model) {
  const citations = [];
  const parts = [];
  const outputText = typeof data?.output_text === 'string' ? data.output_text.trim() : '';
  for (const item of data?.output || []) {
    for (const part of item.content || []) {
      if ((part.type === 'output_text' || part.type === 'text') && part.text) parts.push(part.text);
      collectUrls(part.annotations, citations);
    }
  }
  collectUrls(data?.citations, citations);
  return {
    text: outputText || parts.join('\n').trim(),
    citations: [...new Set(citations)],
    model: data?.model || model,
    error: null,
  };
}

export function perplexityAnswer(data, model) {
  const citations = [];
  const chunks = [];
  const message = data?.choices?.[0]?.message?.content;
  if (typeof message === 'string' && message.trim()) chunks.push(message);
  else if (typeof data?.output_text === 'string' && data.output_text.trim()) chunks.push(data.output_text);
  collectUrls(data?.citations, citations);
  collectUrls(data?.search_results, citations);
  for (const item of data?.output || []) {
    if (!chunks.length) {
      for (const part of item.content || []) {
        if ((part.type === 'output_text' || part.type === 'text') && part.text) chunks.push(part.text);
      }
    }
    collectUrls(item.search_results || item.citations, citations);
    for (const part of item.content || []) collectUrls(part.annotations, citations);
  }
  return {
    text: chunks.join('\n').trim(),
    citations: [...new Set(citations)],
    model: data?.model || model,
    error: null,
  };
}

function anthropicAnswer(data, model) {
  const citations = [];
  const chunks = [];
  for (const block of data.content || []) {
    if (block.type === 'text' && block.text) chunks.push(block.text);
    collectUrls(block.citations, citations);
    collectUrls(block.content, citations);
  }
  return { text: chunks.join('\n').trim(), citations: [...new Set(citations)], model: data.model || model, error: null };
}

export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
export const PERPLEXITY_SONAR_URL = 'https://api.perplexity.ai/v1/sonar';
export const PERPLEXITY_AGENT_URL = 'https://api.perplexity.ai/v1/agent';

function located(city) {
  const loc = place(city);
  const user_location = { country: loc.country, city: loc.city };
  if (loc.region) user_location.region = loc.region;
  return user_location;
}

/** GPT-6.1 Sol defaults to medium reasoning, which plus web search exceeds a 25s abort. */
export function openAiBody({ model, question, city }) {
  return {
    model,
    input: question,
    reasoning: { effort: 'low' },
    tools: [{
      type: 'web_search',
      search_context_size: 'low',
      user_location: openAiLocation(city),
    }],
  };
}

export function perplexitySonarBody({ model, question, city }) {
  return {
    model,
    messages: [{ role: 'user', content: question }],
    web_search_options: { user_location: located(city) },
  };
}

/** Agent API uses effort, not the Sonar model id. Fast turns web search on. */
export function perplexityAgentBody({ question, city }) {
  return {
    effort: 'fast',
    input: question,
    tools: [{ type: 'web_search', user_location: located(city) }],
  };
}

function tagError(err, provider, model) {
  if (err && typeof err === 'object') {
    err.provider = provider;
    err.model = model;
  }
  return err;
}

async function askOpenAI({ question, city, timeoutMs, env }) {
  const model = env.OPENAI_MODEL;
  try {
    const data = await postJson(OPENAI_RESPONSES_URL, {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: openAiBody({ model, question, city }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return openAiAnswer(data, model);
  } catch (err) {
    throw tagError(err, 'chatgpt', model);
  }
}

async function askPerplexity({ question, city, timeoutMs, env }) {
  const model = env.PERPLEXITY_MODEL;
  const signal = AbortSignal.timeout(timeoutMs);
  const headers = {
    Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json',
  };
  try {
    try {
      const data = await postJson(PERPLEXITY_SONAR_URL, {
        headers,
        signal,
        body: perplexitySonarBody({ model, question, city }),
      });
      return perplexityAnswer(data, model);
    } catch (err) {
      if (err.status !== 404 && err.status !== 410) throw err;
      const data = await postJson(PERPLEXITY_AGENT_URL, {
        headers,
        signal,
        body: perplexityAgentBody({ question, city }),
      });
      return perplexityAnswer(data, model);
    }
  } catch (err) {
    throw tagError(err, 'perplexity', model);
  }
}

async function askAnthropic({ question, city, timeoutMs, env }) {
  const model = env.ANTHROPIC_MODEL;
  const loc = place(city);
  try {
    const data = await postJson('https://api.anthropic.com/v1/messages', {
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: {
        model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: question }],
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
            user_location: {
              type: 'approximate',
              city: loc.city,
              ...(loc.region ? { region: loc.region } : {}),
              country: loc.country,
            },
          },
        ],
      },
    });
    return anthropicAnswer(data, model);
  } catch (err) {
    throw tagError(err, 'claude', model);
  }
}

const ASK = { chatgpt: askOpenAI, perplexity: askPerplexity, claude: askAnthropic };

export async function askAssistant(call) {
  const fn = ASK[call.assistant];
  if (!fn) return { text: '', citations: [], model: '', error: 'error' };
  return fn(call);
}
