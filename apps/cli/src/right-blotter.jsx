import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';

import { AGENT_ACCENT_GRADIENT, COLOR } from './theme.js';
/* All hex colors below come from COLOR.* — Catppuccin Mocha palette */

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
export function RightBlotter({ phase, symbol }) {
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
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {/* ── Header ── */}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between">
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
    </Box>
  );
}
