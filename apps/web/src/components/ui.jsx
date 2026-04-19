import React from 'react';
import {cssGradient, COLOR} from '../theme.js';

export function GradientText({colors, children, as = 'span', style, ...rest}) {
  const Tag = as;
  return (
    <Tag
      className="gradient-text"
      style={{backgroundImage: cssGradient(colors), ...style}}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SectionLabel({colors, icon, label, right}) {
  return (
    <div className="row between" style={{marginBottom: 4}}>
      <div className="row" style={{gap: 6}}>
        <span style={{color: COLOR.divider, fontWeight: 700}}>▌</span>
        <GradientText colors={colors}>
          {icon} {label}
        </GradientText>
      </div>
      {right && <span className="dim mono-small">{right}</span>}
    </div>
  );
}

export function Panel({borderColor = COLOR.surface1, children, style}) {
  return (
    <div className="panel" style={{borderColor, ...style}}>
      {children}
    </div>
  );
}
