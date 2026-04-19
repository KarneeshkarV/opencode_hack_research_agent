import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';

export function PromptComposer({ draft, disabled, compact = false }) {
  const borderColor = disabled ? 'yellow' : 'cyan';
  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="column"
    >
      <Box flexDirection="row">
        <Text bold>
          {disabled ? (
            <Text color="yellow">…</Text>
          ) : (
            <Gradient colors={['#22d3ee', '#67e8f9']}>❯</Gradient>
          )}
        </Text>
        <Text> </Text>
        {disabled ? (
          <Text color="gray">waiting for the agent…</Text>
        ) : draft ? (
          <Text>
            {draft}
            <Text color="cyan">▎</Text>
          </Text>
        ) : (
          <Text color="gray">Next prompt — Return to send</Text>
        )}
      </Box>
      {!compact && (
        <Box justifyContent="space-between">
          <Text color="gray" dimColor>
            Return sends · Ctrl+L clears session · Ctrl+C exits
          </Text>
        </Box>
      )}
    </Box>
  );
}
