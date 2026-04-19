/**
 * Best-effort ticker from user query + agent markdown (e.g. "NVIDIA (NVDA)" or "$NVDA").
 */
export function extractTickerHint(query = '', markdown = '') {
  const combined = `${query ?? ''}\n${markdown ?? ''}`;

  const paren = /\(([A-Z]{1,5})\)/.exec(combined);
  if (paren) return paren[1];

  const dollar = /\$([A-Z]{1,5})\b/.exec(combined);
  if (dollar) return dollar[1];

  return null;
}
