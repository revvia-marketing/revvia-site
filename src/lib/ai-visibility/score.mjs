/**
 * Turn stored answers into the on-page score.
 * A failed assistant is "not available" (named: null), never 0.
 * X counts questions where at least one assistant that answered named the business.
 */
import { matchMention } from './match.mjs';

export const ASSISTANTS = ['chatgpt', 'perplexity', 'claude'];

export function scoreAnswers({ business, website, questionCount, answers }) {
  const byAssistant = {};
  for (const id of ASSISTANTS) {
    const rows = (answers || []).filter((a) => a.assistant === id);
    const failed = rows.length === 0 || rows.some((a) => a.error);
    byAssistant[id] = { status: failed ? 'error' : 'ok', named: failed ? null : 0, possible: 0 };
  }

  let namedCount = 0;
  let possibleCount = 0;

  for (let q = 0; q < questionCount; q++) {
    let questionNamed = false;
    for (const id of ASSISTANTS) {
      const cell = byAssistant[id];
      if (cell.status !== 'ok') continue;
      const row = answers.find((a) => a.assistant === id && a.questionIndex === q);
      const kind = matchMention({
        business,
        website,
        text: row?.text || '',
        citations: row?.citations || [],
      });
      if (kind === 'named') {
        cell.named += 1;
        questionNamed = true;
      } else if (kind === 'possible') {
        cell.possible += 1;
        possibleCount += 1;
      }
    }
    if (questionNamed) namedCount += 1;
  }

  const ok = ASSISTANTS.filter((id) => byAssistant[id].status === 'ok');
  const failed = ASSISTANTS.filter((id) => byAssistant[id].status !== 'ok');

  return {
    namedCount,
    possibleCount,
    byAssistant,
    assistantsOk: ok.length,
    failedAssistants: failed,
  };
}
