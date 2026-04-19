import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';

import { AGENT_ACCENT_GRADIENT } from './theme.js';

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

function padLabel(s, w = 10) {
  return s.length >= w ? `${s.slice(0, w - 1)}…` : s.padEnd(w);
}

/**
 * Bloomberg-style right rail: portfolio strip, blotter, instrument summary.
 */
export function RightBlotter({ phase, symbol }) {
  if (!symbol) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="yellow">
          BLOTTER
        </Text>
        <Text color="gray" dimColor>
          No primary instrument — ask about a ticker (e.g. NVDA).
        </Text>
      </Box>
    );
  }

  if (!phase || phase.kind === 'loading') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>
          <Gradient colors={AGENT_ACCENT_GRADIENT}>BLOTTER</Gradient>
        </Text>
        <Text color="gray"> syncing market data…</Text>
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

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>
        <Gradient colors={AGENT_ACCENT_GRADIENT}>BLOTTER</Gradient>
        <Text color="gray"> · {phase.symbol}</Text>
        {phase.source === 'demo' && (
          <Text color="yellow" dimColor>
            {' '}
            SIM
          </Text>
        )}
      </Text>

      <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text bold color="cyan">
          POSITION
        </Text>
        <Text>
          <Text color="gray">{padLabel('sym')}</Text>
          <Text color="white">{phase.symbol}</Text>
        </Text>
        <Text>
          <Text color="gray">{padLabel('qty')}</Text>
          <Text>{qty} sh</Text>
        </Text>
        <Text>
          <Text color="gray">{padLabel('avg')}</Text>
          <Text>{fmt$(avg, phase.currency)}</Text>
        </Text>
        <Text>
          <Text color="gray">{padLabel('last')}</Text>
          <Text bold>{fmt$(px, phase.currency)}</Text>
        </Text>
        <Text>
          <Text color="gray">{padLabel('mkt val')}</Text>
          <Text>{fmt$(mktVal, phase.currency)}</Text>
        </Text>
        <Text>
          <Text color="gray">{padLabel('upl')}</Text>
          <Text color={upnl >= 0 ? 'green' : 'red'} bold>
            {uplStr}
          </Text>
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text bold color="cyan">
          METRICS
        </Text>
        <Text>
          <Text color="gray">{padLabel('3m win%')}</Text>
          <Text color={phase.ret >= 0 ? 'green' : 'red'} bold>
            {phase.ret >= 0 ? '+' : ''}
            {phase.ret.toFixed(2)}%
          </Text>
        </Text>
        <Text>
          <Text color="gray">{padLabel('vs avg $')}</Text>
          <Text color={upnl >= 0 ? 'green' : 'red'} bold>
            {upnl >= 0 ? '+' : ''}
            {fmt$(upnl, phase.currency)}
          </Text>
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text bold color="cyan">
          ORDERS
        </Text>
        <Text color="gray" dimColor>
          BUY 25 @ {fmt$(px * 0.985, phase.currency)} DAY
        </Text>
        <Text color="gray" dimColor>
          SELL 10 @ {fmt$(px * 1.02, phase.currency)} GTC
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text bold color="cyan">
          INSTRUMENT
        </Text>
        <Text>
          <Text color="gray">{padLabel('last')}</Text>
          <Text bold>{fmt$(px, phase.currency)}</Text>
        </Text>
        <Text>
          <Text color="gray">{padLabel('range')}</Text>
          <Text>
            {fmt$(phase.lo, phase.currency)} – {fmt$(phase.hi, phase.currency)}
          </Text>
        </Text>
        <Text>
          <Text color="gray">{padLabel('series')}</Text>
          <Text dimColor>
            3mo daily · {phase.source === 'live' ? 'live' : 'illustrative'}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
