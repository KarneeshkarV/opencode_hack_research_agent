/** Yahoo often rejects minimal UAs; use a normal browser string. */
const CHART_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const FETCH_MS = 18_000;

/**
 * Daily closes for Yahoo chart API (range e.g. 1mo, 3mo, 1y).
 */
export async function fetchYahooCloses(symbol, {range = '3mo', interval = '1d'} = {}) {
  const u = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  );
  u.searchParams.set('interval', interval);
  u.searchParams.set('range', range);

  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(FETCH_MS)
      : undefined;

  const res = await fetch(u, {
    headers: {'User-Agent': CHART_UA},
    ...(signal ? { signal } : {})
  });

  if (!res.ok) {
    throw new Error(`quote request failed (${res.status})`);
  }

  const payload = await res.json();
  const result = payload?.chart?.result?.[0];
  if (!result) {
    throw new Error('no chart data in response');
  }

  const quote = result.indicators?.quote?.[0];
  const rawClose = quote?.close ?? [];
  const ts = result.timestamp ?? [];
  const pairs = [];
  const n = Math.min(rawClose.length, ts.length);
  for (let i = 0; i < n; i++) {
    const c = rawClose[i];
    if (typeof c === 'number' && !Number.isNaN(c) && typeof ts[i] === 'number') {
      pairs.push({ t: ts[i], c });
    }
  }
  if (pairs.length < 2) {
    throw new Error('insufficient price history');
  }

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
      typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : closes[closes.length - 1]
  };
}

export function periodReturnPct(closes) {
  const first = closes[0];
  const last = closes[closes.length - 1];
  if (!first || first === 0) return 0;
  return ((last - first) / first) * 100;
}

export function sparklineChars(values, width = 44) {
  if (values.length < 2) return '';
  const chars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  let sampled = values;
  if (values.length > width) {
    const step = values.length / width;
    sampled = [];
    for (let i = 0; i < width; i++) {
      const idx = Math.min(values.length - 1, Math.floor(i * step));
      sampled.push(values[idx]);
    }
  }

  return sampled
    .map(v => {
      const t = (v - min) / range;
      const idx = Math.min(chars.length - 1, Math.floor(t * (chars.length - 0.001)));
      return chars[idx];
    })
    .join('');
}
