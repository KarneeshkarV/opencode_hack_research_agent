import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

function fmtPriceTick(p) {
  if (!Number.isFinite(p)) return '—';
  if (Math.abs(p) >= 100) return p.toFixed(0);
  if (Math.abs(p) >= 10) return p.toFixed(1);
  return p.toFixed(2);
}

function fmtTimeTick(sec) {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return '—';
  const d = new Date(sec * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Evenly sample `targetLen` points along the series (for bar count). */
function sampleSeries(closes, timestamps, targetLen) {
  if (!closes || closes.length < 2 || targetLen < 1) {
    return { c: [], t: [] };
  }
  const n = closes.length;
  if (targetLen === 1) {
    const ix = n - 1;
    return {
      c: [closes[ix]],
      t: [timestamps ? timestamps[ix] : ix]
    };
  }
  const outC = [];
  const outT = [];
  for (let i = 0; i < targetLen; i++) {
    const ix = Math.min(n - 1, Math.round((i / (targetLen - 1)) * (n - 1)));
    outC.push(closes[ix]);
    outT.push(timestamps ? timestamps[ix] : ix);
  }
  return { c: outC, t: outT };
}

function priceToRow(price, min, max, plotH) {
  if (plotH <= 1) return 0;
  const range = max - min || 1;
  return Math.round(((max - price) / range) * (plotH - 1));
}

function leftGutterRow(r, plotH, min, max) {
  const w = 9;
  if (plotH <= 1) {
    return fmtPriceTick(max).padStart(w);
  }
  const tickRows = [0, Math.floor((plotH - 1) / 2), plotH - 1];
  if (!tickRows.includes(r)) return ' '.repeat(w);
  const range = max - min || 1;
  const p = max - (r / (plotH - 1)) * range;
  return fmtPriceTick(p).padStart(w);
}

/**
 * Vertical bar chart: Y = evaluation (close), X = time.
 * Each period is one Ink Box with backgroundColor (solid fill, no “stacked █” line gaps).
 * Blank column between bars for separation. Green if ≥ prior bar, else red.
 */
export function TimeSeriesSeparatedBarChart({ closes, timestamps, width, height = 12 }) {
  const chart = useMemo(() => {
    const axisW = 9;
    const plotW = Math.max(14, width - axisW - 1);
    const plotH = Math.max(6, Math.min(height, 20));

    if (!closes || closes.length < 2) {
      return {
        bars: [],
        plotH,
        plotW,
        axisW,
        yMin: 0,
        yMax: 1,
        t0: '—',
        t1: '',
        t2: '—'
      };
    }

    let rawMin = Infinity;
    let rawMax = -Infinity;
    for (const v of closes) {
      rawMin = Math.min(rawMin, v);
      rawMax = Math.max(rawMax, v);
    }
    const pad = (rawMax - rawMin) * 0.04 || 0.05;
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;

    const maxBars = Math.floor((plotW + 1) / 2);
    const numBars = Math.max(2, Math.min(maxBars, 48, closes.length));
    const { c: sc, t: st } = sampleSeries(closes, timestamps, numBars);

    const bars = [];
    for (let i = 0; i < sc.length; i++) {
      const pr = sc[i];
      const topRow = priceToRow(pr, yMin, yMax, plotH);
      const heightRows = Math.max(1, plotH - topRow);
      const up = i > 0 ? pr >= sc[i - 1] : true;
      bars.push({
        heightRows,
        backgroundColor: up ? 'green' : 'red'
      });
    }

    const n = st.length;
    const i1 = Math.max(0, Math.floor((n - 1) / 2));
    const i2 = Math.max(0, n - 1);

    return {
      bars,
      plotH,
      plotW,
      axisW,
      yMin,
      yMax,
      t0: fmtTimeTick(st[0]),
      t1: n > 2 ? fmtTimeTick(st[i1]) : '',
      t2: fmtTimeTick(st[i2])
    };
  }, [closes, timestamps, width, height]);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" alignItems="flex-start">
        <Box flexDirection="column" width={chart.axisW} gap={0} style={{ gap: 0 }}>
          {Array.from({ length: chart.plotH }, (_, r) => (
            <Text key={r} color="gray">
              {leftGutterRow(r, chart.plotH, chart.yMin, chart.yMax)}
            </Text>
          ))}
        </Box>
        <Text color="green">│</Text>
        <Box
          flexDirection="row"
          alignItems="flex-end"
          height={chart.plotH}
          width={chart.plotW}
          gap={0}
          style={{ gap: 0 }}
        >
          {chart.bars.length === 0 ? (
            <Text color="gray" dimColor>
              (no series)
            </Text>
          ) : (
            chart.bars.map((bar, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <Box width={1} flexShrink={0}>
                    <Text> </Text>
                  </Box>
                )}
                <Box
                  width={1}
                  height={bar.heightRows}
                  flexShrink={0}
                  backgroundColor={bar.backgroundColor}
                />
              </React.Fragment>
            ))
          )}
        </Box>
      </Box>
      <Box marginLeft={chart.axisW + 1} width={chart.plotW}>
        <Text color="gray">
          {'└'}
          {'─'.repeat(Math.max(0, chart.plotW - 2))}
          {'┘'}
        </Text>
      </Box>
      <Box marginLeft={chart.axisW + 1} width={chart.plotW} flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text color="gray" dimColor>
            {chart.t0}
          </Text>
          {chart.t1 ? (
            <Text color="gray" dimColor>
              {chart.t1}
            </Text>
          ) : (
            <Text> </Text>
          )}
          <Text color="gray" dimColor>
            {chart.t2}
          </Text>
        </Box>
        <Text color="gray" dimColor>
          time (x) · eval / price (y)
        </Text>
      </Box>
    </Box>
  );
}

function downsample(arr, targetLen) {
  if (arr.length <= targetLen) return arr;
  const out = [];
  const step = arr.length / targetLen;
  for (let i = 0; i < targetLen; i++) {
    out.push(arr[Math.min(arr.length - 1, Math.floor(i * step))]);
  }
  return out;
}

export function closesToCandles(closes) {
  return closes.map((c, i) => {
    const o = i > 0 ? closes[i - 1] : c;
    const pad = Math.abs(o) * 0.0015 || 0.05;
    const h = Math.max(o, c) + pad;
    const l = Math.min(o, c) - pad;
    return { o, h, l, c };
  });
}

function charColor(ch, candle) {
  const up = candle.c >= candle.o;
  if (ch === ' ') return 'gray';
  if (ch === '█') return up ? 'green' : 'red';
  if (ch === '▓') return 'red';
  if (ch === '│' || ch === '┃') return up ? 'green' : 'red';
  return 'gray';
}

/**
 * Multi-row TradingView-style ASCII candles (green up / red down bodies).
 */
export function TradingViewAsciiChart({ closes, width, height = 12 }) {
  const { lines, sampled } = useMemo(() => {
    const w = Math.max(12, Math.min(width, 120));
    const h = Math.max(6, Math.min(height, 24));
    if (!closes || closes.length < 2) {
      return {
        lines: Array.from({ length: h }, () => ' '.repeat(w)),
        sampled: []
      };
    }
    const candles = closesToCandles(closes);
    const sampled = downsample(candles, w);
    let min = Infinity;
    let max = -Infinity;
    for (const k of sampled) {
      min = Math.min(min, k.l);
      max = Math.max(max, k.h);
    }
    const range = max - min || 1;
    const rows = [];
    for (let r = 0; r < h; r++) {
      const p = max - (r / Math.max(1, h - 1)) * range;
      let row = '';
      for (let c = 0; c < sampled.length; c++) {
        const k = sampled[c];
        if (p > k.h || p < k.l) {
          row += ' ';
          continue;
        }
        const bodyLo = Math.min(k.o, k.c);
        const bodyHi = Math.max(k.o, k.c);
        const inBody = p <= bodyHi && p >= bodyLo;
        const thick = Math.abs(k.c - k.o) < range * 0.015;
        if (inBody) {
          row += k.c >= k.o ? '█' : '▓';
        } else if (thick) {
          row += '┃';
        } else {
          row += '│';
        }
      }
      rows.push(row.slice(0, w));
    }
    return { lines: rows, sampled };
  }, [closes, width, height]);

  return (
    <Box flexDirection="column">
      {lines.map((line, ri) => (
        <Text key={ri}>
          {line.split('').map((ch, ci) => {
            const candle = sampled[ci];
            if (!candle) return <Text key={ci}>{ch}</Text>;
            return (
              <Text key={ci} color={charColor(ch, candle)} dimColor={ch === ' '}>
                {ch}
              </Text>
            );
          })}
        </Text>
      ))}
    </Box>
  );
}
