/** Input limits for the instant check. Reject URLs and HTML in name and city. */

const TRADES = [
  'Plumbing',
  'HVAC',
  'Electrical',
  'Restoration / water damage',
  'Roofing',
  'Other home services',
];

const URLISH = /https?:|www\.|\.[a-z]{2,}(\/|$)/i;
const HTMLISH = /<[^>]+>|&lt;|&gt;|javascript:/i;

export function trades() {
  return TRADES.slice();
}

export function isTrade(value) {
  return TRADES.includes(String(value || ''));
}

function badText(value) {
  return URLISH.test(value) || HTMLISH.test(value);
}

export function normalizeWebsite(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withProto);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname || !url.hostname.includes('.')) return null;
  return url.toString();
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, fields: Record<string, string> }}
 */
export function validateCheckInput(input, allowedTrades) {
  const fields = {};
  const tradeList = allowedTrades && allowedTrades.length ? allowedTrades : TRADES;
  const business = String(input?.business || '').trim().replace(/\s+/g, ' ');
  const city = String(input?.city || '').trim().replace(/\s+/g, ' ');
  const trade = String(input?.trade || '').trim();
  const noWebsite = Boolean(input?.noWebsite);
  const websiteRaw = noWebsite ? '' : String(input?.website || '').trim();

  if (business.length < 2 || business.length > 100 || badText(business)) {
    fields.business = 'Enter your business name, 2 to 100 characters, with no links.';
  }
  if (city.length < 2 || city.length > 60 || badText(city)) {
    fields.city = 'Enter a city, 2 to 60 characters, with no links.';
  }
  if (!tradeList.includes(trade)) fields.trade = 'Choose a trade from the list.';

  let website = '';
  if (websiteRaw) {
    website = normalizeWebsite(websiteRaw);
    if (!website) fields.website = 'Enter a valid website, or check “I don’t have a website”.';
  }

  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { business, city, trade, website, noWebsite } };
}

/** Safe prefill from query params. Unknown trades and markup fill nothing. */
export function prefillFromQuery(params) {
  const out = { business: '', city: '', trade: '' };
  const business = String(params?.business || '').trim().replace(/\s+/g, ' ');
  const city = String(params?.city || '').trim().replace(/\s+/g, ' ');
  const trade = String(params?.trade || '').trim();
  if (business && business.length <= 100 && !badText(business)) out.business = business;
  if (city && city.length <= 60 && !badText(city)) out.city = city;
  const match = TRADES.find((t) => t.toLowerCase() === trade.toLowerCase());
  if (match) out.trade = match;
  return out;
}
