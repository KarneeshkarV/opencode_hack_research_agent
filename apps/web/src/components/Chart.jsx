import React, {useMemo} from 'react';
import {COLOR} from '../theme.js';

/** Simple vertical-bar chart: green when bar >= open-baseline, red when below. */
export function Chart({closes}) {
  const bars = useMemo(() => {
    if (!closes || closes.length < 2) return [];
    const max = Math.max(...closes);
    const min = Math.min(...closes);
    const range = max - min || 1;
    const baseline = closes[0];
    return closes.map(v => ({
      h: ((v - min) / range) * 100,
      up: v >= baseline
    }));
  }, [closes]);

  if (bars.length === 0) {
    return (
      <div className="chart-host" style={{color: COLOR.meta, alignItems: 'center'}}>
        <span style={{fontSize: 11}}>ask about a ticker to see the chart</span>
      </div>
    );
  }

  return (
    <div className="chart-host">
      {bars.map((b, i) => (
        <div
          key={i}
          className="chart-bar"
          style={{
            height: `${Math.max(2, b.h)}%`,
            background: b.up
              ? `linear-gradient(180deg, ${COLOR.up}, ${COLOR.activeBorder})`
              : `linear-gradient(180deg, ${COLOR.down}, ${COLOR.maroon})`
          }}
        />
      ))}
    </div>
  );
}
