import React, {useEffect, useState} from 'react';
import {COLOR} from '../theme.js';

const BAR_COUNT = 22;
const PALETTE = [
  COLOR.pink,
  COLOR.mauve,
  COLOR.lavender,
  COLOR.sapphire,
  COLOR.sectionHead,
  COLOR.activeBorder,
  COLOR.up,
  COLOR.yellow,
  COLOR.busyBorder,
  COLOR.maroon,
  COLOR.down,
  COLOR.flamingo,
  COLOR.rosewater
];

export function MarketPulse() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % 1_000_000), 160);
    return () => clearInterval(id);
  }, []);

  const heights = Array.from({length: BAR_COUNT}, (_, i) => {
    const t = frame * 0.18;
    const phase = i * 0.55;
    const wave =
      Math.sin(t + phase) * 0.6 + Math.sin(t * 0.5 + phase * 1.7) * 0.4;
    return Math.max(6, Math.round(((wave + 1) / 2) * 100));
  });

  return (
    <div className="pulse-grid">
      {heights.map((h, i) => (
        <div
          key={i}
          className="pulse-bar"
          style={{
            height: `${h}%`,
            background: PALETTE[i % PALETTE.length],
            opacity: 0.85
          }}
        />
      ))}
    </div>
  );
}
