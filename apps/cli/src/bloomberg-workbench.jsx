import React from 'react';
import { Box, Text, useStdout } from 'ink';
import Gradient from 'ink-gradient';

import { MarkdownInk } from './markdown-ink.jsx';
import { PromptComposer } from './prompt-composer.jsx';
import { RightBlotter } from './right-blotter.jsx';
import { TimeSeriesSeparatedBarChart } from './trading-chart.jsx';
import { useMarketSnapshot } from './use-market-snapshot.js';
import { AGENT_GRADIENT, AGENT_ACCENT_GRADIENT, COLOR } from './theme.js';

function useSplitWidths() {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 100;
  const rows = stdout?.rows ?? 30;
  const usable = Math.max(56, cols - 4);
  const gap = 1;
  const inner = usable - gap;
  const leftW = Math.floor(inner * 0.6);
  const rightW = inner - leftW;
  const workbenchH = Math.max(32, Math.min(rows - 2, 72));
  return { cols, rows, leftW, rightW, chartInnerW: Math.max(24, leftW - 4), workbenchH };
}

/** Neon vertical divider — cycles through aurora gradient characters */
function WorkbenchDivider({ height }) {
  const chars = ['▍', '▌', '▍', '▌', '▍'];
  return (
    <Box flexDirection="column" flexShrink={0} overflow="hidden" marginX={0}>
      {Array.from({ length: height }, (_, i) => {
        // alternate between indigo and teal for a pulsing aurora effect
        const color = i % 3 === 0 ? COLOR.divider : i % 3 === 1 ? COLOR.activeBorder : COLOR.mauve;
        return (
          <Text key={i} color={color}>
            {chars[i % chars.length]}
          </Text>
        );
      })}
    </Box>
  );
}

/** Compact section label bar with a left accent */
function SectionLabel({ gradient: gradColors, icon, label, right }) {
  return (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center">
      <Box flexDirection="row" alignItems="center">
        <Text color={COLOR.divider} bold>{'▌'}</Text>
        <Text bold>
          {' '}
          <Gradient colors={gradColors}>{icon} {label}</Gradient>
        </Text>
      </Box>
      {right && (
        <Text color={COLOR.meta} dimColor>{right}</Text>
      )}
    </Box>
  );
}

export function BloombergWorkbench({
  assistantMarkdown,
  chatTurns,
  chatScroll = 0,
  isBusy,
  interactive,
  draft,
  onSnapshotFinished,
  costSummary
}) {
  const { symbol, phase } = useMarketSnapshot(
    '',
    assistantMarkdown ?? '',
    onSnapshotFinished
  );
  const { leftW, rightW, chartInnerW, workbenchH } = useSplitWidths();

  const closes = phase?.kind === 'ok' ? phase.closes : null;
  const ts = phase?.kind === 'ok' ? phase.timestamps : null;
  const loading = symbol && (!phase || phase.kind === 'loading');
  const visibleChatTurns = chatTurns.slice(chatScroll);

  return (
    <Box marginTop={1} flexDirection="column">
      <Box
        flexDirection="row"
        alignItems="flex-start"
        height={workbenchH}
        overflow="hidden"
      >
        {/* ── LEFT COLUMN ── */}
        <Box
          width={leftW}
          height={workbenchH}
          flexDirection="column"
          overflow="hidden"
          flexShrink={0}
          borderStyle="single"
          borderColor={COLOR.divider}
          paddingX={1}
          paddingY={0}
        >
          {/* Chart section */}
          <Box flexShrink={0} flexDirection="column" marginTop={0}>
            <SectionLabel
              gradient={[COLOR.activeBorder, COLOR.divider]}
              icon="▲"
              label={`CHART ${symbol ?? '—'}`}
              right={loading ? '⟳ LOADING…' : symbol ? `bars · y=price · x=time` : 'ask about a ticker'}
            />
            <Box marginTop={0} flexDirection="column">
              <TimeSeriesSeparatedBarChart
                closes={closes}
                timestamps={ts}
                width={chartInnerW}
                height={10}
              />
            </Box>
            {symbol && (
              <Text color={COLOR.meta} dimColor>
                {'  '}green ↑ · red ↓ · j/k scrolls chat
              </Text>
            )}
          </Box>

          {/* AI Chat section */}
          <Box
            flexGrow={1}
            flexDirection="column"
            marginTop={1}
            style={{ minHeight: 0 }}
          >
            <Box
              flexDirection="column"
              borderStyle="single"
              borderColor={COLOR.agentLabel}
              paddingX={1}
              flexGrow={1}
              justifyContent="flex-start"
            >
              <Box marginBottom={1} flexShrink={0}>
                <SectionLabel
                  gradient={AGENT_GRADIENT}
                  icon="◈"
                  label="AI CHAT"
                  right={chatTurns.length > 1 ? `j↓ k↑ · turn ${chatScroll + 1}/${chatTurns.length}` : null}
                />
              </Box>

              {chatTurns.length === 0 && isBusy && (
                <Text color={COLOR.meta} dimColor>
                  {'  '}thinking…
                </Text>
              )}

              {visibleChatTurns.map((turn, i) => (
                <Box key={chatScroll + i} marginTop={i === 0 ? 0 : 1} flexDirection="column">
                  {/* User turn */}
                  <Box flexDirection="row" alignItems="center" marginBottom={0}>
                    <Text color={COLOR.userLabel} bold>▸ you</Text>
                  </Box>
                  <Box paddingLeft={2} marginBottom={1}>
                    <Text wrap="wrap" color={COLOR.text}>
                      {turn.user}
                    </Text>
                  </Box>
                  {/* Agent turn */}
                  <Box flexDirection="row" alignItems="center" marginBottom={0}>
                    <Text bold color={COLOR.agentLabel}>▸ agent</Text>
                  </Box>
                  <Box marginTop={0} flexDirection="column" paddingLeft={2}>
                    <MarkdownInk text={turn.assistant} />
                  </Box>
                </Box>
              ))}

              {isBusy && chatTurns.length > 0 && (
                <Box marginTop={1}>
                  <Text color={COLOR.busyBorder}>⟳ working on reply…</Text>
                </Box>
              )}
            </Box>
          </Box>

          {/* Prompt composer */}
          {interactive && (
            <Box flexShrink={0} marginTop={1} width="100%">
              <PromptComposer draft={draft} disabled={isBusy} compact />
            </Box>
          )}
        </Box>

        {/* ── DIVIDER ── */}
        <WorkbenchDivider height={workbenchH} />

        {/* ── RIGHT COLUMN ── */}
        <Box
          width={rightW}
          height={workbenchH}
          flexDirection="column"
          overflow="hidden"
          flexShrink={0}
        >
          <RightBlotter phase={phase} symbol={symbol} costSummary={costSummary} />
        </Box>
      </Box>
    </Box>
  );
}
