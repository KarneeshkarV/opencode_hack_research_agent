import React from 'react';
import {GradientText} from './GradientText.jsx';
import {Chart} from './Chart.jsx';
import {MarketPulse} from './MarketPulse.jsx';
import {AGENT_ACCENT_GRADIENT, COLOR} from '../theme.js';

function fmt$(n, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(n);
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
}

function Row({label, children, color}) {
  return (
    <div className="blotter-row">
      <span className="lbl">{label}</span>
      <span className="val" style={color ? {color} : undefined}>
        {children}
      </span>
    </div>
  );
}

function Card({title, color, children}) {
  return (
    <div className="blotter-card" style={{borderColor: color}}>
      <div className="title" style={{color}}>
        {title}
      </div>
      {children}
    </div>
  );
}

function formatCostSummary(summary) {
  const parts = [];
  const total = summary?.cost_usd?.total;
  if (typeof total === 'number' && total > 0) parts.push(`cost $${total.toFixed(4)}`);
  if (typeof summary?.tokens === 'number' && summary.tokens > 0)
    parts.push(`${summary.tokens.toLocaleString()} tokens`);
  if (typeof summary?.latency_seconds === 'number' && summary.latency_seconds > 0)
    parts.push(`${summary.latency_seconds.toFixed(1)}s traced`);
  return parts.length > 0 ? parts.join(' · ') : 'no cost data yet';
}

export function Blotter({symbol, phase, costSummary}) {
  return (
    <div className="col" style={{padding: '4px 2px', gap: 4}}>
      <div className="row between">
        <GradientText colors={AGENT_ACCENT_GRADIENT}>◈ BLOTTER</GradientText>
        {symbol && (
          <span style={{color: COLOR.text, fontWeight: 700}}>{symbol}</span>
        )}
      </div>

      {!symbol ? (
        <div className="panel panel-round" style={{marginTop: 6, color: COLOR.meta}}>
          No instrument — ask about a ticker (e.g. NVDA, AAPL, TSLA).
          <div style={{marginTop: 6, color: COLOR.axis, fontSize: 11}}>
            Try: "What is NVDA doing?" · "Compare TSLA and RIVN"
          </div>
        </div>
      ) : phase?.kind !== 'ok' ? (
        <div className="panel panel-round" style={{marginTop: 6, color: COLOR.meta}}>
          <span className="pulse">⟳</span> syncing {symbol} market data…
        </div>
      ) : (
        <>
          <Card title="▸ CHART" color={COLOR.activeBorder}>
            <Chart closes={phase.closes} />
            <div
              style={{
                color: COLOR.meta,
                fontSize: 11,
                marginTop: 4,
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>green ↑ · red ↓ · 3mo daily</span>
              <span>
                {phase.source === 'live' ? '● live' : '○ sim'}
              </span>
            </div>
          </Card>

          <Card title="▸ INSTRUMENT" color={COLOR.sectionHead}>
            <Row label="last">
              <span className="bold" style={{color: COLOR.text}}>
                {fmt$(phase.regularMarketPrice, phase.currency)}
              </span>
            </Row>
            <Row label="range">
              {fmt$(phase.lo, phase.currency)} –{' '}
              {fmt$(phase.hi, phase.currency)}
            </Row>
            <Row
              label="3mo return"
              color={phase.ret >= 0 ? COLOR.up : COLOR.down}
            >
              <span style={{fontWeight: 700}}>
                {phase.ret >= 0 ? '+' : ''}
                {phase.ret.toFixed(2)}%
              </span>
            </Row>
          </Card>

          <Card title="▸ COST" color={COLOR.up}>
            <div style={{color: COLOR.body, fontSize: 12}}>
              {formatCostSummary(costSummary)}
            </div>
          </Card>
        </>
      )}

      <Card title="▸ MARKET PULSE" color={COLOR.mauve}>
        <MarketPulse />
      </Card>
    </div>
  );
}
