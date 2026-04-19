import React, {useMemo} from 'react';
import {GradientText} from './GradientText.jsx';
import {AGENT_GRADIENT, AGENT_H3_GRADIENT} from '../theme.js';

/** Minimal markdown → React, mirrors apps/cli/src/markdown-ink.jsx */
function parseBlocks(text) {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) {
      i++;
      continue;
    }
    if (/^---+$/.test(t)) {
      blocks.push({type: 'hr'});
      i++;
      continue;
    }
    const h2 = /^##\s+(.+?)\s*$/.exec(raw);
    if (h2) {
      blocks.push({type: 'h2', text: h2[1].trim()});
      i++;
      continue;
    }
    const h3 = /^###\s+(.+?)\s*$/.exec(raw);
    if (h3) {
      blocks.push({type: 'h3', text: h3[1].trim()});
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
      blocks.push({type: 'ul', items});
      continue;
    }
    const ol = /^\s*(\d+)\.\s+(.+)$/.exec(raw);
    if (ol) {
      const items = [{n: ol[1], text: ol[2]}];
      i++;
      while (i < lines.length) {
        const m = /^\s*(\d+)\.\s+(.+)$/.exec(lines[i]);
        if (!m) break;
        items.push({n: m[1], text: m[2]});
        i++;
      }
      blocks.push({type: 'ol', items});
      continue;
    }
    const para = [raw];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      if (/^#{1,3}\s/.test(next)) break;
      if (/^---+$/.test(next.trim())) break;
      if (/^\s*[-*]\s/.test(next)) break;
      if (/^\s*\d+\.\s/.test(next)) break;
      para.push(next);
      i++;
    }
    blocks.push({type: 'p', lines: para});
  }
  return blocks;
}

function renderInline(s, keyPrefix = '') {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (
      part.startsWith('*') &&
      part.endsWith('*') &&
      part.length > 2 &&
      !part.startsWith('**')
    ) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <span key={key}>{part}</span>;
  });
}

export function Markdown({text}) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="md">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'hr':
            return <hr key={i} />;
          case 'h2':
            return (
              <h2 key={i}>
                <GradientText colors={AGENT_GRADIENT}>{b.text}</GradientText>
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i}>
                <GradientText colors={AGENT_H3_GRADIENT}>{b.text}</GradientText>
              </h3>
            );
          case 'ul':
            return (
              <ul key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <span>{renderInline(item, `${i}-${j}-`)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <span className="num">{item.n}.</span>
                    <span>{renderInline(item.text, `${i}-${j}-`)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'p':
            return <p key={i}>{renderInline(b.lines.map(l => l.trim()).join(' '), `${i}-`)}</p>;
          default:
            return null;
        }
      })}
    </div>
  );
}
