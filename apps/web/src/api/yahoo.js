/**
 * Browser-side Yahoo chart fetch (3mo daily). Falls back to a sensible
 * seeded series when the request fails or is blocked by CORS.
 */

const CHART_UA = undefined; // browser supplies its own UA
const FETCH_MS = 12_000;

export async function fetchYahooCloses(symbol, {range = '3mo', interval = '1d'} = {}) {
  const u = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  );
  u.searchParams.set('interval', interval);
  u.searchParams.set('range', range);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  let res;
  try {
    res = await fetch(u, {
      signal: controller.signal,
      headers: CHART_UA ? {'User-Agent': CHART_UA} : undefined
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`yahoo quote failed (${res.status})`);

  const payload = await res.json();
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error('no chart data');

  const quote = result.indicators?.quote?.[0];
  const rawClose = quote?.close ?? [];
  const ts = result.timestamp ?? [];
  const pairs = [];
  const n = Math.min(rawClose.length, ts.length);
  for (let i = 0; i < n; i++) {
    const c = rawClose[i];
    if (typeof c === 'number' && !Number.isNaN(c) && typeof ts[i] === 'number') {
      pairs.push({t: ts[i], c});
    }
  }
  if (pairs.length < 2) throw new Error('insufficient price history');

  const closes = pairs.map(p => p.c);
  const timestamps = pairs.map(p => p.t);
  const meta = result.meta ?? {};
  const currency = meta.currency ?? 'USD';

  return {
    symbol: meta.symbol ?? symbol.toUpperCase(),
    currency,
    closes,
    timestamps,
    regularMarketPrice:
      typeof meta.regularMarketPrice === 'number'
        ? meta.regularMarketPrice
        : closes[closes.length - 1]
  };
}

export function periodReturnPct(closes) {
  const first = closes[0];
  const last = closes[closes.length - 1];
  if (!first || first === 0) return 0;
  return ((last - first) / first) * 100;
}

/** Deterministic demo series so the blotter looks alive when Yahoo is unavailable. */
export function getDemoSeries(symbol, points = 60) {
  let seed = 1;
  for (const ch of (symbol ?? 'DEMO').toUpperCase()) {
    seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  }
  const closes = [];
  const timestamps = [];
  const nowSec = Math.floor(Date.now() / 1000);
  let price = 50 + (seed % 250);
  for (let i = 0; i < points; i++) {
    seed = (seed * 48271) % 2147483647;
    const u = (seed % 10_000) / 10_000 - 0.5;
    price = Math.max(5, price * (1 + u * 0.035));
    closes.push(price);
    timestamps.push(nowSec - (points - 1 - i) * 86400);
  }
  return {closes, timestamps};
}

export function extractTickerHint(query = '', markdown = '') {
  const combined = `${query ?? ''}\n${markdown ?? ''}`;
  const paren = /\(([A-Z]{1,5})\)/.exec(combined);
  if (paren) return paren[1];
  const dollar = /\$([A-Z]{1,5})\b/.exec(combined);
  if (dollar) return dollar[1];
  return null;
}
