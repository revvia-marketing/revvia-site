/** Replace build-time placeholders. Leaves runtime tokens such as {city} alone. */

export function fillStatic(template, vars) {
  const instant = Boolean(vars.instant);
  const instantPhrase = (atStart) => {
    if (instant) return vars.instantTurnaround;
    const phrase = `by email ${vars.checkTurnaround}`;
    return atStart ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase;
  };
  return String(template ?? '')
    .replace(/\{instantTurnaround\}/g, (_m, offset, str) => {
      const before = str.slice(0, offset);
      const atStart = offset === 0 || /[.!?]\s+$/.test(before);
      return instantPhrase(atStart);
    })
    .replaceAll('{checkTurnaround}', vars.checkTurnaround)
    .replaceAll('{setupDays}', String(vars.setupDays))
    .replaceAll('{primaryCtaLabel}', vars.primaryCtaLabel)
    .replaceAll('{primaryCtaShort}', vars.primaryCtaShort);
}

export function fillTree(value, vars) {
  if (typeof value === 'string') return fillStatic(value, vars);
  if (Array.isArray(value)) return value.map((item) => fillTree(item, vars));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = fillTree(item, vars);
    return out;
  }
  return value;
}
