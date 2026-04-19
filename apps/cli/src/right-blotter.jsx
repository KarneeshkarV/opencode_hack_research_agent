import React, { useEffect, useState, useRef } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';

import { AGENT_ACCENT_GRADIENT, COLOR } from './theme.js';
/* All hex colors below come from COLOR.* — Catppuccin Mocha palette */

/**
 * Lightweight "user is interacting" bus.
 *
 * Writing into the terminal while the user is scrolling causes visible flicker
 * because the animation's frequent re-renders interleave with scroll redraws.
 * We freeze the MarketPulse animation briefly after every keypress so the
 * terminal gets quiet frames to complete the scroll paint cleanly.
 *
 * `notifyUserActivity()` is called from the top-level useInput handler in
 * app.jsx. `MarketPulse` below checks this timestamp each tick and skips its
 * setState (i.e. no re-render) while within QUIET_AFTER_INPUT_MS of the last
 * keypress.
 */
const ACTIVITY = { lastKeyTs: 0 };
export const QUIET_AFTER_INPUT_MS = 400;
export function notifyUserActivity() {
  ACTIVITY.lastKeyTs = Date.now();
}

function fmt$(n, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function padLabel(s, w = 11) {
  return s.length >= w ? `${s.slice(0, w - 1)}…` : s.padEnd(w);
}

/** Single labelled row: left=dim label, right=value */
function Row({ label, children, dimLabel = true }) {
  return (
    <Box flexDirection="row">
      <Text color={dimLabel ? COLOR.meta : COLOR.body}>{padLabel(label)}</Text>
      <Box>{children}</Box>
    </Box>
  );
}

/** Blotter section card */
function BlotterCard({ title, titleColor, children }) {
  return (
    <Box
      marginTop={1}
      flexDirection="column"
      borderStyle="single"
      borderColor={titleColor ?? COLOR.meta}
      paddingX={1}
    >
      <Text bold color={titleColor ?? COLOR.sectionHead}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

/**
 * Neon Aurora right rail: portfolio strip, blotter, instrument summary.
 */
function sumOrderCharge(orders, key) {
  if (!Array.isArray(orders)) return 0;
  return orders.reduce((acc, o) => acc + Number(o?.charges?.[key] ?? 0), 0);
}

function CostCard({ costSummary }) {
  // No response yet from /sessions/{id}/cost
  if (!costSummary) {
    return (
      <BlotterCard title="▸ COST" titleColor={COLOR.up}>
        <Text color={COLOR.meta} dimColor>awaiting cost summary…</Text>
      </BlotterCard>
    );
  }

  const costUsdObj = costSummary.cost_usd; // null when Langfuse disabled
  const tokenCostUsd = Number(costUsdObj?.total ?? 0);
  const tokens = Number(costSummary.tokens ?? 0);
  const sttInr = sumOrderCharge(costSummary.orders, 'stt');
  const brokerageInr = sumOrderCharge(costSummary.orders, 'brokerage');
  const orderCount = Array.isArray(costSummary.orders) ? costSummary.orders.length : 0;

  return (
    <BlotterCard title="▸ COST" titleColor={COLOR.up}>
      <Row label="tokens">
        {costUsdObj == null ? (
          <Text color={COLOR.meta} dimColor>n/a (langfuse off)</Text>
        ) : (
          <>
            <Text color={COLOR.text} bold>${tokenCostUsd.toFixed(4)}</Text>
            <Text color={COLOR.meta}> · {tokens.toLocaleString()} tok</Text>
          </>
        )}
      </Row>
      <Row label="stt">
        {orderCount === 0 ? (
          <Text color={COLOR.meta} dimColor>no orders</Text>
        ) : (
          <Text color={COLOR.body}>₹{sttInr.toFixed(2)}</Text>
        )}
      </Row>
      <Row label="brokerage">
        {orderCount === 0 ? (
          <Text color={COLOR.meta} dimColor>no orders</Text>
        ) : (
          <Text color={COLOR.body}>₹{brokerageInr.toFixed(2)}</Text>
        )}
      </Row>
    </BlotterCard>
  );
}

/**
 * MarketPulse
 * ───────────
 * A purely decorative bouncing-bars animation that sits below the COST card.
 * No text, no labels, no title — just a tall multi-row bar chart where each
 * column bounces up and down on its own sine-wave phase, like a big music
 * equalizer. Has NO dependency on prompt/market data.
 *
 *   • BAR_COUNT columns spread across the panel, each with its own phase
 *     offset so the row ripples like a wave traveling across.
 *   • BAR_ROWS rows tall — each row prints the portion of the bar that
 *     belongs at that vertical level (full block if the bar is taller
 *     than this row, partial block at the top, space if the bar is
 *     shorter than this row).
 *   • Each column has a pastel rainbow color; the top of each bar is
 *     rendered bold for a soft glow.
 *
 * Pure-CPU, no deps — ink re-renders on a TICK_MS timer via setState.
 *
 * Anti-flicker: the animation freezes for QUIET_AFTER_INPUT_MS after any
 * keypress (signalled via `notifyUserActivity()` from app.jsx). Skipping the
 * setState during that window means zero re-renders while the user is
 * scrolling, which lets the terminal complete its scroll redraw cleanly
 * instead of fighting the animation's 6–10 fps repaints.
 */
const BAR_PARTIAL = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']; // 8 partial fills
const BAR_COUNT = 18; // columns (width of the chart)
const BAR_ROWS = 6; // vertical rows — each row = 8 sub-levels, so total height = 48 sub-units
const TICK_MS = 160;

/** Pastel rainbow across the bars (Catppuccin-ish). Loops if BAR_COUNT > length. */
const BAR_PALETTE = [
  COLOR.pink,
  COLOR.mauve,
  COLOR.lavender,
  COLOR.sapphire,
  COLOR.sectionHead, // sky
  COLOR.activeBorder, // teal
  COLOR.up, // green
  COLOR.yellow,
  COLOR.busyBorder, // peach
  COLOR.maroon,
  COLOR.down, // red
  COLOR.flamingo,
  COLOR.rosewater,
  COLOR.pink,
  COLOR.mauve,
  COLOR.lavender,
  COLOR.sapphire,
  COLOR.sectionHead,
];

const MarketPulse = React.memo(function MarketPulse() {
  // Single monotonic frame counter drives every sine wave so the whole
  // widget moves in harmony rather than randomly.
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Skip the tick entirely (no setState → no re-render) while the user
      // has recently interacted with the TTY. This prevents flicker when
      // scrolling chat with j/k or typing in the prompt.
      if (Date.now() - ACTIVITY.lastKeyTs < QUIET_AFTER_INPUT_MS) return;
      setFrame((f) => (f + 1) % 1_000_000);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Compute each bar's height in sub-units (0 .. BAR_ROWS * 8).
  const maxSub = BAR_ROWS * BAR_PARTIAL.length; // e.g. 8 rows * 8 = 64
  const heights = Array.from({ length: BAR_COUNT }, (_, i) => {
    const t = frame * 0.18;
    const phase = i * 0.55;
    const wave = Math.sin(t + phase) * 0.6 + Math.sin(t * 0.5 + phase * 1.7) * 0.4;
    // Map wave ∈ [-1, 1] → height ∈ [0, maxSub], with a little headroom
    // so the bars visibly crest and trough.
    return Math.round(((wave + 1) / 2) * maxSub);
  });

  // Render from top row (BAR_ROWS-1) down to bottom row (0). For each row,
  // for each column, emit: full block, partial block, or space.
  const rows = [];
  for (let r = BAR_ROWS - 1; r >= 0; r--) {
    const rowFloor = r * BAR_PARTIAL.length; // sub-units consumed by rows below
    const rowCeil = rowFloor + BAR_PARTIAL.length; // sub-units if this row is full
    const cells = heights.map((h, i) => {
      const color = BAR_PALETTE[i % BAR_PALETTE.length];
      let glyph;
      let isTop = false;
      if (h >= rowCeil) {
        // Bar fully covers this row.
        glyph = '█';
      } else if (h > rowFloor) {
        // Bar tops out somewhere in this row — pick the matching partial.
        glyph = BAR_PARTIAL[h - rowFloor - 1];
        isTop = true;
      } else {
        // Bar is shorter than this row — empty space (but keep width).
        glyph = ' ';
      }
      return (
        <Text key={i} color={color} bold={isTop}>
          {' '}
          {glyph}
        </Text>
      );
    });
    rows.push(
      <Box key={r} flexDirection="row" justifyContent="center" width="100%">
        {cells}
      </Box>
    );
  }

  return (
    <Box
      marginTop={1}
      flexDirection="column"
      alignItems="center"
      width="100%"
      height={BAR_ROWS}
      flexShrink={0}
      overflow="hidden"
    >
      {rows}
    </Box>
  );
});

export function RightBlotter({ phase, symbol, costSummary }) {
  if (!symbol) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={0}>
        {/* Title */}
        <Box flexDirection="row" alignItems="center">
          <Text color={COLOR.divider} bold>▌</Text>
          <Text bold>
            {'  '}
            <Gradient colors={AGENT_ACCENT_GRADIENT}>◈ BLOTTER</Gradient>
          </Text>
        </Box>
        <Box marginTop={1} borderStyle="round" borderColor={COLOR.meta} paddingX={1}>
          <Text color={COLOR.meta}>
            No instrument — ask about a ticker (e.g. NVDA)
          </Text>
        </Box>
        {/* Placeholder hints */}
        <Box marginTop={1} flexDirection="column">
          <Text color={COLOR.axis} dimColor>  Try asking:</Text>
          <Text color={COLOR.body} dimColor>  "What is NVDA doing?"</Text>
          <Text color={COLOR.body} dimColor>  "Analyze AAPL vs MSFT"</Text>
          <Text color={COLOR.body} dimColor>  "Compare TSLA and RIVN"</Text>
        </Box>
      </Box>
    );
  }

  if (!phase || phase.kind === 'loading') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row" alignItems="center">
          <Text color={COLOR.divider} bold>▌</Text>
          <Text bold>
            {'  '}
            <Gradient colors={AGENT_ACCENT_GRADIENT}>◈ BLOTTER</Gradient>
          </Text>
        </Box>
        <Text color={COLOR.meta}>  ⟳  syncing {symbol} market data…</Text>
      </Box>
    );
  }

  const px = phase.regularMarketPrice;
  const qty = 100;
  const avg = px * (1 - phase.ret / 200 / 100);
  const mktVal = px * qty;
  const cost = avg * qty;
  const upnl = mktVal - cost;
  const upnlPct = cost !== 0 ? (upnl / cost) * 100 : 0;
  const uplStr = `${upnl >= 0 ? '+' : ''}${fmt$(upnl, phase.currency)} (${upnlPct >= 0 ? '+' : ''}${upnlPct.toFixed(1)}%)`;
  const isUp = upnl >= 0;
  const pnlColor = isUp ? COLOR.up : COLOR.down;
  const retColor = phase.ret >= 0 ? COLOR.up : COLOR.down;

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      paddingY={0}
      width="100%"
      height="100%"
      overflow="hidden"
    >
      {/* ── Header ── */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" flexShrink={0}>
        <Box flexDirection="row" alignItems="center">
          <Text color={COLOR.divider} bold>▌</Text>
          <Text bold>
            {'  '}
            <Gradient colors={AGENT_ACCENT_GRADIENT}>◈ BLOTTER</Gradient>
          </Text>
        </Box>
        <Box flexDirection="row" alignItems="center">
          <Text color={COLOR.text} bold> {phase.symbol}</Text>
          {phase.source === 'demo' && (
            <Text color={COLOR.busyBorder} dimColor> SIM</Text>
          )}
        </Box>
      </Box>

      {/* ── POSITION ── */}
      <BlotterCard title="▸ POSITION" titleColor={COLOR.sectionHead}>
        <Row label="symbol">
          <Text color={COLOR.text} bold>{phase.symbol}</Text>
        </Row>
        <Row label="qty">
          <Text color={COLOR.body}>{qty} sh</Text>
        </Row>
        <Row label="avg cost">
          <Text color={COLOR.body}>{fmt$(avg, phase.currency)}</Text>
        </Row>
        <Row label="last px">
          <Text color={COLOR.text} bold>{fmt$(px, phase.currency)}</Text>
        </Row>
        <Row label="mkt val">
          <Text color={COLOR.body}>{fmt$(mktVal, phase.currency)}</Text>
        </Row>
        <Row label="unreal P&L">
          <Text color={pnlColor} bold>{uplStr}</Text>
        </Row>
      </BlotterCard>

      {/* ── METRICS ── */}
      <BlotterCard title="▸ METRICS" titleColor={COLOR.mauve}>
        <Row label="3mo return">
          <Text color={retColor} bold>
            {phase.ret >= 0 ? '+' : ''}
            {phase.ret.toFixed(2)}%
          </Text>
        </Row>
        <Row label="vs avg $">
          <Text color={pnlColor} bold>
            {upnl >= 0 ? '+' : ''}
            {fmt$(upnl, phase.currency)}
          </Text>
        </Row>
        <Row label="sparkline">
          <Text color={COLOR.body}>{phase.sparkline ?? '—'}</Text>
        </Row>
      </BlotterCard>

      {/* ── ORDERS ── */}
      <BlotterCard title="▸ ORDERS" titleColor={COLOR.busyBorder}>
        <Box flexDirection="row">
          <Text color={COLOR.up} bold>BUY  </Text>
          <Text color={COLOR.body}>25 @ {fmt$(px * 0.985, phase.currency)}</Text>
          <Text color={COLOR.meta}> DAY</Text>
        </Box>
        <Box flexDirection="row">
          <Text color={COLOR.down} bold>SELL </Text>
          <Text color={COLOR.body}>10 @ {fmt$(px * 1.02, phase.currency)}</Text>
          <Text color={COLOR.meta}> GTC</Text>
        </Box>
      </BlotterCard>

      {/* ── INSTRUMENT ── */}
      <BlotterCard title="▸ INSTRUMENT" titleColor={COLOR.activeBorder}>
        <Row label="last">
          <Text color={COLOR.text} bold>{fmt$(px, phase.currency)}</Text>
        </Row>
        <Row label="range">
          <Text color={COLOR.body}>
            {fmt$(phase.lo, phase.currency)}
            <Text color={COLOR.meta}> – </Text>
            {fmt$(phase.hi, phase.currency)}
          </Text>
        </Row>
        <Row label="series">
          <Text color={COLOR.meta} dimColor>
            3mo daily · {phase.source === 'live' ? '● live' : '○ sim'}
          </Text>
        </Row>
      </BlotterCard>

      {/* ── COST ── */}
      <CostCard costSummary={costSummary} />

      {/* ── MARKET PULSE (decorative animation, not tied to data) ── */}
      <MarketPulse />
    </Box>
  );
}
