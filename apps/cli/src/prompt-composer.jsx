import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { COLOR, QUERY_ARROW_GRADIENT } from './theme.js';

export function PromptComposer({ draft, disabled, compact = false }) {
  const borderColor = disabled ? COLOR.busyBorder : COLOR.activeBorder;

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="column"
    >
      <Box flexDirection="row" alignItems="center">
        {/* Prompt glyph */}
        <Text bold>
          {disabled ? (
            <Text color={COLOR.busyBorder}>⟳</Text>
          ) : (
            <Gradient colors={QUERY_ARROW_GRADIENT}>❯</Gradient>
          )}
        </Text>
        <Text>{'  '}</Text>

        {/* Input area */}
        {disabled ? (
          <Text color={COLOR.meta}>waiting for the agent…</Text>
        ) : draft ? (
          <Text>
            <Text color={COLOR.text}>{draft}</Text>
            <Text color={COLOR.activeBorder} bold>▎</Text>
          </Text>
        ) : (
          <Text color={COLOR.axis}>Type your query — Return to send</Text>
        )}
      </Box>

      {!compact && (
        <Box marginTop={0} justifyContent="space-between">
          <Text color={COLOR.meta} dimColor>
            Return sends  ·  Ctrl+L clears  ·  Ctrl+C exits  ·  j/k scrolls chat
          </Text>
        </Box>
      )}
    </Box>
  );
}
