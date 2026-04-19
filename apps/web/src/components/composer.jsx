import React, {useEffect, useRef} from 'react';
import {COLOR, QUERY_ARROW_GRADIENT, cssGradient} from '../theme.js';

export function Composer({draft, setDraft, onSubmit, disabled, compact}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const q = draft.trim();
      if (q.length > 0 && !disabled) onSubmit(q);
    }
  };

  return (
    <div className={`composer${disabled ? ' disabled' : ''}`}>
      <div className="composer-input">
        <span
          className="gradient-text"
          style={{
            backgroundImage: disabled
              ? `linear-gradient(90deg, ${COLOR.busyBorder}, ${COLOR.busyBorder})`
              : cssGradient(QUERY_ARROW_GRADIENT),
            fontSize: 16
          }}
        >
          {disabled ? '⟳' : '❯'}
        </span>
        <textarea
          ref={ref}
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            disabled ? 'waiting for the agent…' : 'Type your query — Return to send'
          }
          spellCheck={false}
          autoFocus
        />
        {!disabled && <span className="caret">▎</span>}
      </div>
      {!compact && (
        <div className="hint-bar">
          <span>Return sends · Shift+Return = newline · Ctrl+L clears · j/k scrolls chat</span>
          <span>{draft.length > 0 ? `${draft.length} chars` : 'ready'}</span>
        </div>
      )}
    </div>
  );
}
