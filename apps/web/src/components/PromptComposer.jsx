import React, {useEffect, useRef} from 'react';
import {GradientText} from './GradientText.jsx';
import {QUERY_ARROW_GRADIENT, COLOR} from '../theme.js';

export function PromptComposer({draft, setDraft, onSubmit, disabled}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = draft.trim();
      if (trimmed.length > 0 && !disabled) onSubmit(trimmed);
    }
  };

  return (
    <div className={`composer ${disabled ? 'disabled' : ''}`}>
      <div className="composer-input">
        <span style={{fontWeight: 700}}>
          {disabled ? (
            <span className="pulse" style={{color: COLOR.busyBorder}}>⟳</span>
          ) : (
            <GradientText colors={QUERY_ARROW_GRADIENT}>❯</GradientText>
          )}
        </span>
        <textarea
          ref={ref}
          rows={1}
          value={disabled ? '' : draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? 'waiting for the agent…' : 'Type your query — Return to send'
          }
          disabled={disabled}
        />
        {!disabled && <span className="caret">▎</span>}
      </div>
      <div className="hint-bar">
        <span>Return sends  ·  Shift+Enter newline  ·  Ctrl+L clears</span>
        <span>{draft.length > 0 && !disabled ? `${draft.length} chars` : ''}</span>
      </div>
    </div>
  );
}
