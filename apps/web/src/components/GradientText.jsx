import React from 'react';
import {cssGradient} from '../theme.js';

export function GradientText({colors, children, as: Tag = 'span', style, ...rest}) {
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
