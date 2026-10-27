export const ASSISTANT_LABELS = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  claude: 'Claude',
};

export function assistantLabel(name) {
  if (ASSISTANT_LABELS[name]) return ASSISTANT_LABELS[name];
  const text = String(name || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/** Answers that were actually scored: 8 per assistant that responded. */
export function footerAnswerCount(byAssistant, questionCount = 8) {
  const ok = Object.values(byAssistant || {}).filter((row) => row && row.status !== 'error' && row.named != null).length;
  return ok * questionCount;
}
