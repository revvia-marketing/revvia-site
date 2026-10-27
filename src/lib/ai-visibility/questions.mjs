/** Fill the shared question templates. `{city}` can be left literal. */

export function renderQuestion(template, vars, { literalCity = false } = {}) {
  const city = literalCity ? '{city}' : String(vars.city || '');
  return String(template || '')
    .replaceAll('{pro}', String(vars.pro || ''))
    .replaceAll('{trade}', String(vars.tradeNoun || vars.trade || ''))
    .replaceAll('{job}', String(vars.job || ''))
    .replaceAll('{city}', city);
}

export function renderSet(entry, city, opts) {
  const templates = entry.templates || [];
  return templates.map((template, index) => ({
    index,
    template,
    text: renderQuestion(template, { ...entry, city }, opts),
  }));
}

export const TEMPLATES = [
  'Who is the best {pro} in {city}?',
  'I need an emergency {pro} in {city} right now. Who should I call?',
  'Which {trade} companies in {city} have the best reviews?',
  'Can you recommend a licensed and insured {pro} near {city}?',
  'Who should I call for {job} in {city}?',
  "What's a trustworthy {trade} company in {city} with fair prices?",
  'Which {trade} companies serve {city} and the nearby areas?',
  'Who do locals recommend for {trade} in {city}?',
];
