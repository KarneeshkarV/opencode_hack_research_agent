import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getDemoSeries } from './demo-series.js';
import { extractTickerHint } from './ticker-guess.js';
import { fetchYahooCloses, periodReturnPct, sparklineChars } from './yahoo-chart.js';

function chartWidthFromStdout() {
  const cols =
    typeof process !== 'undefined' && typeof process.stdout?.columns === 'number'
      ? process.stdout.columns
      : 80;
  return Math.max(28, Math.min(56, cols - 8));
}

function buildSnapshotPhase({
  closes,
  timestamps,
  symbol,
  currency,
  regularMarketPrice,
  source,
  warn
}) {
  const w = chartWidthFromStdout();
  const ret = periodReturnPct(closes);
  const spark = sparklineChars(closes, w);
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const ts =
    timestamps ??
    closes.map(
      (_, i) => Math.floor(Date.now() / 1000) - (closes.length - 1 - i) * 86_400
    );
  return {
    kind: 'ok',
    source,
    warn,
    symbol,
    currency,
    regularMarketPrice,
    ret,
    spark,
    lo,
    hi,
    closes,
    timestamps: ts
  };
}

/**
 * Loads Yahoo closes (or demo fallback) for the ticker implied by query + markdown.
 */
export function useMarketSnapshot(query, markdown, onFinished) {
  const symbol = useMemo(() => extractTickerHint(query, markdown), [query, markdown]);
  const [phase, setPhase] = useState(null);
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onFinished);
  onDoneRef.current = onFinished;

  const fireFinished = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDoneRef.current?.();
  }, []);

  useEffect(() => {
    if (!symbol) {
      setPhase(null);
      return;
    }
    let cancel = false;
    setPhase({ kind: 'loading' });
    (async () => {
      try {
        const data = await fetchYahooCloses(symbol, { range: '3mo', interval: '1d' });
        if (cancel) return;
        setPhase(
          buildSnapshotPhase({
            closes: data.closes,
            timestamps: data.timestamps,
            symbol: data.symbol,
            currency: data.currency,
            regularMarketPrice: data.regularMarketPrice,
            source: 'live',
            warn: null
          })
        );
      } catch (caught) {
        if (cancel) return;
        const message = caught instanceof Error ? caught.message : String(caught);
        const demo = getDemoSeries(symbol);
        const last = demo.closes[demo.closes.length - 1];
        setPhase(
          buildSnapshotPhase({
            closes: demo.closes,
            timestamps: demo.timestamps,
            symbol: symbol.toUpperCase(),
            currency: 'USD',
            regularMarketPrice: last,
            source: 'demo',
            warn: message
          })
        );
      }
    })();
    return () => {
      cancel = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    if (phase && phase.kind !== 'loading') {
      fireFinished();
    }
  }, [phase, symbol, fireFinished]);

  return { symbol, phase };
}
