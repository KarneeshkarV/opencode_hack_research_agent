/**
 * Deterministic synthetic daily closes for demos / offline fallback (not real prices).
 * NVDA-shaped range so the sparkline reads as a plausible mega-cap equity curve.
 */
export function getDemoCloses(symbol) {
  return getDemoSeries(symbol).closes;
}

const MS_PER_DAY = 86_400_000;

/**
 * Same as getDemoCloses plus synthetic calendar timestamps (UTC midnight steps) for chart axes.
 */
export function getDemoSeries(symbol) {
  const key = (symbol ?? 'UNK').toUpperCase();
  let seed = 0;
  for (let i = 0; i < key.length; i++) {
    seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  }

  const days = 62;
  const base = key === 'NVDA' ? 468 + (seed % 12) : 40 + (seed % 120);
  const closes = [];
  let v = base;
  for (let i = 0; i < days; i++) {
    const wave = Math.sin(i * 0.38 + (seed % 5)) * 6.2;
    const drift = i * 0.42;
    const jitter = ((seed * (i + 3)) % 17) / 17 - 0.45;
    v = Math.max(1, v + drift * 0.05 + wave * 0.35 + jitter);
    if (key === 'NVDA') {
      v = Math.min(980, Math.max(120, v));
    }
    closes.push(Math.round(v * 100) / 100);
  }

  const now = Date.now();
  const timestamps = closes.map((_, i) =>
    Math.floor((now - (closes.length - 1 - i) * MS_PER_DAY) / 1000)
  );

  return { closes, timestamps };
}
