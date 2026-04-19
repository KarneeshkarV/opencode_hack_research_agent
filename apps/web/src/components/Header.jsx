import React from 'react';
import {GradientText} from './GradientText.jsx';
import {BRAND_GRADIENT, TAGLINE_GRADIENT, COLOR} from '../theme.js';

const STATUS_COLOR = {
  idle: COLOR.meta,
  connecting: COLOR.yellow,
  running: COLOR.yellow,
  done: COLOR.up,
  error: COLOR.down
};

const STATUS_ICON = {
  idle: '○',
  connecting: '◌',
  running: '◉',
  done: '◆',
  error: '✖'
};

export function Header({apiUrl, sessionId, statusLabel}) {
  const color = STATUS_COLOR[statusLabel] ?? COLOR.meta;
  const icon = STATUS_ICON[statusLabel] ?? '○';
  return (
    <div className="col" style={{gap: 2}}>
      <div className="row between">
        <div className="row" style={{gap: 4}}>
          <GradientText colors={BRAND_GRADIENT} style={{fontSize: 15}}>
            ▲ RESEARCH AGENT
          </GradientText>
          <GradientText colors={TAGLINE_GRADIENT} style={{fontWeight: 400}}>
            {'  ·  neon aurora terminal'}
          </GradientText>
        </div>
        <div className="status-pill" style={{color}}>
          <span className={statusLabel === 'running' || statusLabel === 'connecting' ? 'pulse' : ''}>{icon}</span>
          <span>{statusLabel.toUpperCase()}</span>
        </div>
      </div>
      <div className="row mono-small" style={{gap: 10, color: COLOR.meta}}>
        <span>⬡ {apiUrl}</span>
        {sessionId && <span>·  ⧖ {sessionId}</span>}
      </div>
    </div>
  );
}
