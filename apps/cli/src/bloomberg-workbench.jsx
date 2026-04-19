import React from 'react';
import { Box, Text, useStdout } from 'ink';
import Gradient from 'ink-gradient';

import { MarkdownInk } from './markdown-ink.jsx';
import { PromptComposer } from './prompt-composer.jsx';
import { RightBlotter } from './right-blotter.jsx';
import { TimeSeriesSeparatedBarChart } from './trading-chart.jsx';
import { useMarketSnapshot } from './use-market-snapshot.js';
import { AGENT_GRADIENT } from './theme.js';

function useSplitWidths() {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 100;
  const rows = stdout?.rows ?? 30;
  const usable = Math.max(56, cols - 4);
  const gap = 1;
  const inner = usable - gap;
  const leftW = Math.floor(inner * 0.6);
  const rightW = inner - leftW;
  const workbenchH = Math.max(14, Math.min(rows - 10, 52));
  return { cols, rows, leftW, rightW, chartInnerW: Math.max(24, leftW - 4), workbenchH };
}

function WorkbenchDivider({ height }) {
  return (
    <Box flexDirection="column" flexShrink={0} overflow="hidden">
      {Array.from({ length: height }, (_, i) => (
        <Text key={i} color="green">
          ┃
        </Text>
      ))}
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
  onSnapshotFinished
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
        <Box
          width={leftW}
          height={workbenchH}
          flexDirection="column"
          overflow="hidden"
          flexShrink={0}
          borderStyle="single"
          borderColor="green"
          paddingX={1}
          paddingY={1}
        >
          <Box flexShrink={0} flexDirection="column">
            <Text bold color="green">
              CHART
              <Text color="gray"> {symbol ?? '—'} · bars · y=eval · x=time</Text>
              {loading && <Text color="yellow"> · LOADING</Text>}
            </Text>
            <Box marginTop={0} flexDirection="column">
              <TimeSeriesSeparatedBarChart
                closes={closes}
                timestamps={ts}
                width={chartInnerW}
                height={11}
              />
            </Box>
            <Text color="gray" dimColor>
              {symbol
                ? 'filled bars (no stacked glyphs) · space between bars · green vs prior · j/k chat when draft empty'
                : 'Ask about a ticker to load chart'}
            </Text>
          </Box>

          <Box
            flexGrow={1}
            flexDirection="column"
            overflow="hidden"
            marginTop={1}
            style={{ minHeight: 0 }}
          >
            <Box
              flexDirection="column"
              borderStyle="single"
              borderColor="magenta"
              paddingX={1}
              flexGrow={1}
              overflow="hidden"
              height="100%"
              justifyContent="flex-start"
              gap={0}
              style={{ gap: 0 }}
            >
              <Box flexDirection="row" justifyContent="space-between">
                <Text bold>
                  <Gradient colors={AGENT_GRADIENT}>AI CHAT</Gradient>
                </Text>
                {chatTurns.length > 1 && (
                  <Text color="gray" dimColor>
                    j↓ k↑ · skip older turns
                  </Text>
                )}
              </Box>

              {chatTurns.length === 0 && isBusy && (
                <Text color="gray" dimColor>
                  Thinking…
                </Text>
              )}

              {visibleChatTurns.map((turn, i) => (
                <Box key={chatScroll + i} marginTop={i === 0 ? 0 : 1} flexDirection="column">
                  <Text color="cyan" bold>
                    you
                  </Text>
                  <Text wrap="wrap" color="gray">
                    {turn.user}
                  </Text>
                  <Box marginTop={0}>
                    <Text bold color="magenta">
                      agent
                    </Text>
                  </Box>
                  <Box marginTop={0} flexDirection="column" width={leftW - 4}>
                    <MarkdownInk text={turn.assistant} />
                  </Box>
                </Box>
              ))}

              {isBusy && chatTurns.length > 0 && (
                <Box marginTop={1}>
                  <Text color="yellow">… working on reply</Text>
                </Box>
              )}
            </Box>
          </Box>

          {interactive && (
            <Box flexShrink={0} marginTop={1}>
              <PromptComposer draft={draft} disabled={isBusy} compact />
            </Box>
          )}
        </Box>

        <WorkbenchDivider height={workbenchH} />

        <Box
          width={rightW}
          height={workbenchH}
          flexDirection="column"
          overflow="hidden"
          flexShrink={0}
        >
          <RightBlotter phase={phase} symbol={symbol} />
        </Box>
      </Box>
    </Box>
  );
}
