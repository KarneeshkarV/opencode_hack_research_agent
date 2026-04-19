import {useEffect, useMemo, useState} from 'react';
import {
  fetchYahooCloses,
  periodReturnPct,
  extractTickerHint,
  getDemoSeries
} from '../api/yahoo.js';

function buildPhase({closes, timestamps, symbol, currency, regularMarketPrice, source}) {
  return {
    kind: 'ok',
    source,
    symbol,
    currency,
    regularMarketPrice,
    closes,
    timestamps,
    lo: Math.min(...closes),
    hi: Math.max(...closes),
    ret: periodReturnPct(closes)
  };
}

export function useMarketSnapshot(query, markdown) {
  const symbol = useMemo(
    () => extractTickerHint(query, markdown),
    [query, markdown]
  );
  const [phase, setPhase] = useState(null);

  useEffect(() => {
    if (!symbol) {
      setPhase(null);
      return;
    }
    let cancelled = false;
    setPhase({kind: 'loading'});

    (async () => {
      try {
        const data = await fetchYahooCloses(symbol);
        if (cancelled) return;
        setPhase(
          buildPhase({
            closes: data.closes,
            timestamps: data.timestamps,
            symbol: data.symbol,
            currency: data.currency,
            regularMarketPrice: data.regularMarketPrice,
            source: 'live'
          })
        );
      } catch {
        if (cancelled) return;
        const demo = getDemoSeries(symbol);
        setPhase(
          buildPhase({
            closes: demo.closes,
            timestamps: demo.timestamps,
            symbol: symbol.toUpperCase(),
            currency: 'USD',
            regularMarketPrice: demo.closes.at(-1),
            source: 'demo'
          })
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return {symbol, phase};
}
