/**
 * Name matching for the AI Visibility Check.
 * Named = the normalized business name is a phrase in the answer, or the
 * website domain appears in the answer or its citations.
 * Possible = a partial or close-spelling match. Possible is never counted.
 */

const DROPPED = new Set(['llc', 'inc', 'co', 'corp', 'company']);

export function normalize(value) {
  let s = String(value || '').toLowerCase();
  s = s.replace(/&/g, ' and ');
  s = s.replace(/['’]/g, '');
  s = s.replace(/[^a-z0-9]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  const parts = s.split(' ').filter(Boolean);
  while (parts.length && parts[0] === 'the') parts.shift();
  while (parts.length && DROPPED.has(parts[parts.length - 1])) parts.pop();
  return parts.join(' ');
}

export function domainOf(website) {
  const raw = String(website || '').trim();
  if (!raw) return '';
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withProto).hostname.replace(/^www\./i, '').toLowerCase();
    if (!host || !host.includes('.') || host.length < 4) return '';
    return host;
  } catch {
    return '';
  }
}

function tokens(normalized) {
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

function close(a, b) {
  if (!a || !b || a === b) return false;
  const max = Math.max(a.length, b.length);
  if (max < 5) return false;
  const limit = max >= 8 ? 2 : 1;
  return levenshtein(a, b) <= limit;
}

/**
 * @returns {'named' | 'possible' | 'none'}
 */
export function matchMention({ business, website, text, citations }) {
  const name = normalize(business);
  const answer = normalize(text);
  const cites = (citations || []).map((c) => String(c || ''));
  const domain = domainOf(website);
  const haystack = `${text || ''}\n${cites.join('\n')}`.toLowerCase();

  if (domain && haystack.includes(domain)) return 'named';
  if (!name) return 'none';
  if (!answer && !haystack) return 'none';

  if (answer && phraseIn(answer, name)) return 'named';

  const nameWords = tokens(name);
  const answerWords = tokens(answer);
  if (!nameWords.length || !answerWords.length) return 'none';

  const distinctive = nameWords.filter((w) => w.length > 2);
  const words = distinctive.length ? distinctive : nameWords;
  const need = Math.max(1, Math.ceil(words.length / 2));
  const window = words.length + 3;

  for (let i = 0; i < answerWords.length; i++) {
    const slice = answerWords.slice(i, i + window);
    let hits = 0;
    let spelling = false;
    for (const w of words) {
      if (slice.includes(w)) hits += 1;
      else if (slice.some((s) => close(s, w))) {
        hits += 1;
        spelling = true;
      }
    }
    if (hits >= need && (hits < words.length || spelling || !phraseIn(answer, name))) {
      if (hits >= need) return 'possible';
    }
  }

  // A single close spelling of a one-word name, or of the full phrase smashed together.
  const compactName = name.replace(/ /g, '');
  const compactAnswer = answer.replace(/ /g, '');
  if (compactName.length >= 5 && close(compactAnswer, compactName)) return 'possible';

  return 'none';
}

function phraseIn(haystack, phrase) {
  if (!phrase) return false;
  const padded = ` ${haystack} `;
  return padded.includes(` ${phrase} `);
}
