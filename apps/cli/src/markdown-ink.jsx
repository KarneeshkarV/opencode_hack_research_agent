import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';

import { AGENT_GRADIENT, AGENT_H3_GRADIENT, COLOR } from './theme.js';

function parseMarkdownBlocks(text) {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    if (/^---+$/u.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    const h2 = /^##\s+(.+?)\s*$/.exec(raw);
    if (h2) {
      blocks.push({ type: 'h2', text: h2[1].trim() });
      i++;
      continue;
    }

    const h3 = /^###\s+(.+?)\s*$/.exec(raw);
    if (h3) {
      blocks.push({ type: 'h3', text: h3[1].trim() });
      i++;
      continue;
    }

    const ul = /^\s*[-*]\s+(.+)$/.exec(raw);
    if (ul) {
      const items = [ul[1]];
      i++;
      while (i < lines.length) {
        const m = /^\s*[-*]\s+(.+)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    const ol = /^\s*(\d+)\.\s+(.+)$/.exec(raw);
    if (ol) {
      const items = [{ n: ol[1], text: ol[2] }];
      i++;
      while (i < lines.length) {
        const m2 = /^\s*(\d+)\.\s+(.+)$/.exec(lines[i]);
        if (!m2) break;
        items.push({ n: m2[1], text: m2[2] });
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const para = [raw];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      const t = next.trim();
      if (/^#{1,3}\s/u.test(next)) break;
      if (/^---+$/u.test(t)) break;
      if (/^\s*[-*]\s/u.test(next)) break;
      if (/^\s*\d+\.\s/u.test(next)) break;
      para.push(next);
      i++;
    }
    blocks.push({ type: 'p', lines: para });
  }

  return blocks;
}

function renderInline(s) {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(p => p.length > 0);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={i} bold color={COLOR.text}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (
      part.startsWith('*') &&
      part.endsWith('*') &&
      part.length > 2 &&
      !part.startsWith('**')
    ) {
      return (
        <Text key={i} italic color={COLOR.meta}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return (
      <Text key={i} color={COLOR.body}>
        {part}
      </Text>
    );
  });
}

function paragraphBody(lines) {
  return lines.map(l => l.trim()).join(' ');
}

function Block({ block }) {
  switch (block.type) {
    case 'hr':
      return (
        <Box marginY={0}>
          <Text color={COLOR.divider} dimColor>
            {'─'.repeat(20)}
          </Text>
        </Box>
      );
    case 'h2':
      return (
        <Box marginTop={1} flexDirection="column">
          <Text wrap="wrap">
            <Text bold>
              <Gradient colors={AGENT_GRADIENT}>{block.text}</Gradient>
            </Text>
          </Text>
        </Box>
      );
    case 'h3':
      return (
        <Box marginTop={1} flexDirection="column">
          <Text wrap="wrap">
            <Text bold>
              <Gradient colors={AGENT_H3_GRADIENT}>{block.text}</Gradient>
            </Text>
          </Text>
        </Box>
      );
    case 'ul':
      return (
        <Box flexDirection="column" marginTop={0}>
          {block.items.map((item, j) => (
            <Box key={j} flexDirection="row">
              <Text>
                <Gradient colors={AGENT_GRADIENT}>◆ </Gradient>
              </Text>
              <Text wrap="wrap">{renderInline(item)}</Text>
            </Box>
          ))}
        </Box>
      );
    case 'ol':
      return (
        <Box flexDirection="column" marginTop={0}>
          {block.items.map((item, j) => (
            <Box key={j} flexDirection="row">
              <Text color={COLOR.mauve} bold>
                {item.n}.{' '}
              </Text>
              <Text wrap="wrap">{renderInline(item.text)}</Text>
            </Box>
          ))}
        </Box>
      );
    case 'p':
      return (
        <Box marginTop={0} flexDirection="column">
          <Text wrap="wrap">{renderInline(paragraphBody(block.lines))}</Text>
        </Box>
      );
    default:
      return null;
  }
}

export function MarkdownInk({ text }) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  return (
    <Box flexDirection="column">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </Box>
  );
}
