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
function sumOrderCharge(orders, key) {
  if (!Array.isArray(orders)) return 0;
  return orders.reduce((acc, o) => acc + Number(o?.charges?.[key] ?? 0), 0);
}

function fmtInr(n) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(n);
  } catch {
    return `₹${Number(n).toFixed(2)}`;
  }
}

/** Derive a net position from the real orders captured by the backend.
 *  BUY adds qty (weighted into avg cost), SELL reduces qty. */
function derivePositionFromOrders(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return null;

  const bySymbol = new Map();
  for (const o of orders) {
    const sym = o?.tradingsymbol;
    if (!sym) continue;
    const qty = Number(o?.quantity ?? 0);
    const px = Number(o?.price ?? 0);
    const side = String(o?.transaction_type ?? '').toUpperCase();
    if (!qty || !px) continue;

    const entry = bySymbol.get(sym) ?? {
      symbol: sym,
      exchange: o?.exchange ?? null,
      buyQty: 0,
      buyCost: 0,
      sellQty: 0,
      lastPx: px
    };
    entry.lastPx = px;
    if (side === 'BUY') {
      entry.buyQty += qty;
      entry.buyCost += qty * px;
    } else if (side === 'SELL') {
      entry.sellQty += qty;
    }
    bySymbol.set(sym, entry);
  }

  // Pick the symbol with the largest net position; most sessions have one.
  let best = null;
  for (const entry of bySymbol.values()) {
    const netQty = entry.buyQty - entry.sellQty;
    const score = Math.abs(netQty) || entry.buyQty + entry.sellQty;
    if (!best || score > best.score) {
      best = { entry, netQty, score };
    }
  }
  if (!best) return null;

  const { entry, netQty } = best;
  const avgCost = entry.buyQty > 0 ? entry.buyCost / entry.buyQty : 0;
  return {
    symbol: entry.symbol,
    exchange: entry.exchange,
    qty: netQty,
    avgCost,
    lastPx: entry.lastPx
  };
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
  const orders = Array.isArray(costSummary?.orders) ? costSummary.orders : [];
  const realPosition = derivePositionFromOrders(orders);
  // Real orders are Kite (INR). Fall back to market data for the instrument
  // panel & metrics when no orders have been placed yet.
  const hasPosition = realPosition !== null && realPosition.qty !== 0;
  const qty = hasPosition ? realPosition.qty : 0;
  const avg = hasPosition ? realPosition.avgCost : 0;
  const posLastPx = hasPosition ? realPosition.lastPx : px;
  const posCurrency = hasPosition ? 'INR' : phase.currency;
  const mktVal = qty * posLastPx;
  const cost = avg * qty;
  const upnl = mktVal - cost;
  const upnlPct = cost !== 0 ? (upnl / cost) * 100 : 0;
  const uplStr = `${upnl >= 0 ? '+' : ''}${fmt$(upnl, posCurrency)} (${upnlPct >= 0 ? '+' : ''}${upnlPct.toFixed(1)}%)`;
  const isUp = upnl >= 0;
  const pnlColor = isUp ? COLOR.up : COLOR.down;
  const retColor = phase.ret >= 0 ? COLOR.up : COLOR.down;
  const posSymbol = hasPosition ? realPosition.symbol : phase.symbol;

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
          <Text color={COLOR.text} bold>{posSymbol}</Text>
        </Row>
        {hasPosition ? (
          <>
            <Row label="qty">
              <Text color={COLOR.body}>{qty} sh</Text>
            </Row>
            <Row label="avg cost">
              <Text color={COLOR.body}>{fmt$(avg, posCurrency)}</Text>
            </Row>
            <Row label="last px">
              <Text color={COLOR.text} bold>{fmt$(posLastPx, posCurrency)}</Text>
            </Row>
            <Row label="mkt val">
              <Text color={COLOR.body}>{fmt$(mktVal, posCurrency)}</Text>
            </Row>
            <Row label="unreal P&L">
              <Text color={pnlColor} bold>{uplStr}</Text>
            </Row>
          </>
        ) : (
          <>
            <Row label="qty">
              <Text color={COLOR.meta} dimColor>no position</Text>
            </Row>
            <Row label="last px">
              <Text color={COLOR.text} bold>{fmt$(px, phase.currency)}</Text>
            </Row>
          </>
        )}
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
          {hasPosition ? (
            <Text color={pnlColor} bold>
              {upnl >= 0 ? '+' : ''}
              {fmt$(upnl, posCurrency)}
            </Text>
          ) : (
            <Text color={COLOR.meta} dimColor>—</Text>
          )}
        </Row>
        <Row label="sparkline">
          <Text color={COLOR.body}>{phase.sparkline ?? '—'}</Text>
        </Row>
      </BlotterCard>

      {/* ── ORDERS ── */}
      <BlotterCard title="▸ ORDERS" titleColor={COLOR.busyBorder}>
        {orders.length === 0 ? (
          <Text color={COLOR.meta} dimColor>no orders placed this session</Text>
        ) : (
          orders.slice(-4).map((o, i) => {
            const side = String(o.transaction_type ?? '').toUpperCase();
            const isBuy = side === 'BUY';
            const tag = o.dry_run ? 'DRY' : (o.product ?? '').toUpperCase() || 'LIVE';
            return (
              <Box key={o.order_id ?? `${side}-${i}`} flexDirection="row">
                <Text color={isBuy ? COLOR.up : COLOR.down} bold>
                  {isBuy ? 'BUY  ' : 'SELL '}
                </Text>
                <Text color={COLOR.body}>
                  {o.quantity} @ {fmtInr(Number(o.price ?? 0))}
                </Text>
                <Text color={COLOR.meta}> {tag}</Text>
              </Box>
            );
          })
        )}
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
    </Box>
  );
}
