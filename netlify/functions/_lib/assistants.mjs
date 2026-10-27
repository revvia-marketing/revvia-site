/**
 * Official APIs only. Model names come from the environment.
 * No system prompt, no temperature override, no consumer apps, no Google.
 *
 * OpenAI: Responses API + web_search
 *   https://developers.openai.com/api/docs/guides/tools-web-search
 * Perplexity: Sonar chat completions (search is built in). If that route has
 * been removed, one follow-up tries the Agent API the vendor documents as
 * the successor: https://docs.perplexity.ai/docs/agent-api/quickstart
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`http ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function openAiAnswer(data, model) {
  const citations = [];
  const chunks = [];
  if (typeof data.output_text === 'string' && data.output_text.trim()) chunks.push(data.output_text);
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (!chunks.length && part.type === 'output_text' && part.text) chunks.push(part.text);
      collectUrls(part.annotations, citations);
    }
  }
  collectUrls(data.citations, citations);
  return { text: chunks.join('\n').trim(), citations: [...new Set(citations)], model: data.model || model, error: null };
}

function perplexityAnswer(data, model) {
  const citations = [];
  const chunks = [];
  const message = data.choices?.[0]?.message?.content;
  if (typeof message === 'string') chunks.push(message);
  collectUrls(data.citations, citations);
  collectUrls(data.search_results, citations);
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if ((part.type === 'output_text' || part.type === 'text') && part.text) chunks.push(part.text);
    }
    collectUrls(item.search_results || item.citations, citations);
  }
  return { text: chunks.join('\n').trim(), citations: [...new Set(citations)], model: data.model || model, error: null };
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

async function askOpenAI({ question, city, timeoutMs, env }) {
  const model = env.OPENAI_MODEL;
  const data = await postJson('https://api.openai.com/v1/responses', {
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: {
      model,
      input: question,
      tools: [{ type: 'web_search', user_location: openAiLocation(city) }],
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return openAiAnswer(data, model);
}

async function askPerplexity({ question, city, timeoutMs, env }) {
  const model = env.PERPLEXITY_MODEL;
  const loc = place(city);
  const signal = AbortSignal.timeout(timeoutMs);
  const headers = {
    Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json',
  };
  try {
    const data = await postJson('https://api.perplexity.ai/chat/completions', {
      headers,
      signal,
      body: {
        model,
        messages: [{ role: 'user', content: question }],
        web_search_options: {
          user_location: { country: loc.country, city: loc.city, region: loc.region || undefined },
        },
      },
    });
    return perplexityAnswer(data, model);
  } catch (err) {
    if (err.status !== 404 && err.status !== 410) throw err;
    const data = await postJson('https://api.perplexity.ai/v1/agent', {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: {
        model,
        input: question,
        tools: [{ type: 'web_search', user_location: { country: loc.country, city: loc.city, region: loc.region || undefined } }],
      },
    });
    return perplexityAnswer(data, model);
  }
}

async function askAnthropic({ question, city, timeoutMs, env }) {
  const model = env.ANTHROPIC_MODEL;
  const loc = place(city);
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
}

const ASK = { chatgpt: askOpenAI, perplexity: askPerplexity, claude: askAnthropic };

export async function askAssistant(call) {
  const fn = ASK[call.assistant];
  if (!fn) return { text: '', citations: [], model: '', error: 'error' };
  return fn(call);
}
