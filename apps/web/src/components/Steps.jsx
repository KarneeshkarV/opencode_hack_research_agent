import React from 'react';
import {GradientText} from './GradientText.jsx';
import {STEPS_GRADIENT, COLOR} from '../theme.js';

const COLOR_MAP = {
  cyan: COLOR.sectionHead,
  green: COLOR.up,
  yellow: COLOR.yellow,
  red: COLOR.down
};

export function Steps({steps}) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="col" style={{gap: 4, marginTop: 4}}>
      <GradientText colors={STEPS_GRADIENT}>⚡ STEPS</GradientText>
      <div className="steps">
        {steps.map(step => (
          <div className="step-row" key={step.id}>
            <span
              className="step-marker"
              style={{color: COLOR_MAP[step.color] ?? COLOR.sectionHead}}
            >
              {step.marker}
            </span>
            <span style={{color: COLOR.sectionHead}}>{step.label}</span>
            <span style={{color: COLOR.body}}>{step.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
