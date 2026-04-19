import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {
  runResearchStream,
  fetchSessionCost,
  parseSseEvents,
  extractFinalResponse
} from './api/client.js';
import {formatIntermediateStep, mergeRecentSteps} from './api/steps.js';
import {useMarketSnapshot} from './hooks/useMarketSnapshot.js';

import {Header} from './components/Header.jsx';
import {PromptComposer} from './components/PromptComposer.jsx';
import {Markdown} from './components/Markdown.jsx';
import {Steps} from './components/Steps.jsx';
import {Blotter} from './components/Blotter.jsx';
import {GradientText} from './components/GradientText.jsx';

import {
  AGENT_GRADIENT,
  BRAND_GRADIENT,
  QUERY_ARROW_GRADIENT,
  COLOR
} from './theme.js';

const SESSION_ID = `web-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

export function App() {
  const [draft, setDraft] = useState('');
  const [chatTurns, setChatTurns] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState([]);
  const [costSummary, setCostSummary] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const abortRef = useRef(null);
  const chatRef = useRef(null);
  const runningStreamTextRef = useRef('');

  const isBusy = status === 'running' || status === 'connecting';

  // Live ticker extraction from the latest assistant markdown (or current user turn)
  const lastAssistant = useMemo(
    () => chatTurns.map(t => t.assistant).join('\n\n'),
    [chatTurns]
  );
  const lastUser = chatTurns.at(-1)?.user ?? '';
  const {symbol, phase} = useMarketSnapshot(lastUser, lastAssistant);

  // Busy timer
  useEffect(() => {
    if (!isBusy) return;
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 200);
    return () => clearInterval(id);
  }, [isBusy]);

  // Auto-scroll chat on new content
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatTurns, status]);

  // Ctrl+L clears
  useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (isBusy) return;
        setChatTurns([]);
        setSteps([]);
        setError(null);
        setCostSummary(null);
        setStatus('idle');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isBusy]);

  const handleSubmit = useCallback(
    async query => {
      if (isBusy) return;

      setError(null);
      setStatus('connecting');
      setSteps([]);
      runningStreamTextRef.current = '';

      // Optimistic turn with empty assistant reply that we will fill on completion
      setChatTurns(prev => [...prev, {user: query, assistant: ''}]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setStatus('running');
        const stream = runResearchStream(query, {
          sessionId: SESSION_ID,
          signal: controller.signal
        });

        let sseBuffer = '';
        for await (const chunk of stream) {
          runningStreamTextRef.current += chunk;
          const {events, remainder} = parseSseEvents(sseBuffer + chunk);
          sseBuffer = remainder;

          if (events.length > 0) {
            const formattedSteps = events
              .map(formatIntermediateStep)
              .filter(Boolean);
            if (formattedSteps.length > 0) {
              setSteps(curr => mergeRecentSteps(curr, formattedSteps));
            }
          }
        }

        const assistant = extractFinalResponse(runningStreamTextRef.current);
        setChatTurns(prev => {
          const copy = prev.slice();
          copy[copy.length - 1] = {user: query, assistant};
          return copy;
        });
        setStatus('done');

        // Best-effort cost fetch
        fetchSessionCost(SESSION_ID)
          .then(summary => setCostSummary(summary))
          .catch(() => {});
      } catch (caught) {
        if (controller.signal.aborted) {
          setStatus('idle');
          return;
        }
        const err = caught instanceof Error ? caught : new Error(String(caught));
        setError(err);
        setStatus('error');
      } finally {
        abortRef.current = null;
      }
    },
    [isBusy]
  );

  const handleStop = () => {
    abortRef.current?.abort(new Error('User cancelled'));
  };

  return (
    <div className="app-shell">
      <Header
        apiUrl="/api → research-agent backend"
        sessionId={SESSION_ID}
        statusLabel={status}
      />

      {chatTurns.length === 0 && !isBusy ? (
        <EmptyState />
      ) : (
        <div className="workbench">
          <div className="workbench-left">
            <div
              className="row between"
              style={{marginBottom: 8, flexShrink: 0}}
            >
              <GradientText colors={AGENT_GRADIENT}>◈ AI CHAT</GradientText>
              <span style={{color: COLOR.meta, fontSize: 11}}>
                {isBusy
                  ? `researching · ${elapsed.toFixed(1)}s`
                  : status === 'done'
                    ? `done · ${elapsed.toFixed(1)}s`
                    : status === 'error'
                      ? 'error'
                      : ''}
              </span>
            </div>

            <div className="chat-area" ref={chatRef}>
              {chatTurns.map((turn, i) => (
                <div key={i} className="chat-turn">
                  <div style={{color: COLOR.userLabel, fontWeight: 700}}>
                    ▸ you
                  </div>
                  <div
                    style={{
                      paddingLeft: 16,
                      color: COLOR.text,
                      marginBottom: 8,
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {turn.user}
                  </div>
                  <div style={{color: COLOR.agentLabel, fontWeight: 700}}>
                    ▸ agent
                  </div>
                  <div style={{paddingLeft: 16}}>
                    {turn.assistant ? (
                      <Markdown text={turn.assistant} />
                    ) : isBusy && i === chatTurns.length - 1 ? (
                      <span className="pulse" style={{color: COLOR.busyBorder}}>
                        ⟳ thinking…
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}

              {steps.length > 0 && isBusy && (
                <div style={{marginTop: 10}}>
                  <Steps steps={steps} />
                </div>
              )}
            </div>

            {!isBusy && steps.length > 0 && (
              <div style={{marginTop: 8, flexShrink: 0}}>
                <Steps steps={steps} />
              </div>
            )}

            <div style={{marginTop: 10, flexShrink: 0}}>
              <PromptComposer
                draft={draft}
                setDraft={setDraft}
                disabled={isBusy}
                onSubmit={q => {
                  setDraft('');
                  handleSubmit(q);
                }}
              />
              {isBusy && (
                <div style={{marginTop: 6, textAlign: 'right'}}>
                  <button
                    onClick={handleStop}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${COLOR.down}`,
                      color: COLOR.down,
                      borderRadius: 6,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 11
                    }}
                  >
                    ✖ STOP
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="error-panel" style={{marginTop: 10, flexShrink: 0}}>
                ✖ {error.message}
              </div>
            )}
          </div>

          <div className="workbench-divider" />

          <div className="workbench-right">
            <Blotter symbol={symbol} phase={phase} costSummary={costSummary} />
          </div>
        </div>
      )}

      {chatTurns.length === 0 && !isBusy && (
        <div style={{flexShrink: 0}}>
          <PromptComposer
            draft={draft}
            setDraft={setDraft}
            disabled={isBusy}
            onSubmit={q => {
              setDraft('');
              handleSubmit(q);
            }}
          />
          {error && (
            <div className="error-panel" style={{marginTop: 10}}>
              ✖ {error.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col" style={{gap: 10, padding: '24px 6px'}}>
      <div style={{fontSize: 16}}>
        <GradientText colors={BRAND_GRADIENT}>
          ◈ Ready for a deep research pass.
        </GradientText>
      </div>
      <div style={{color: COLOR.body}}>
        Paste a task · compare options · scope an investigation
      </div>
      <div
        className="panel panel-round"
        style={{color: COLOR.meta, marginTop: 4}}
      >
        <GradientText colors={QUERY_ARROW_GRADIENT}>❯</GradientText>{' '}
        Try: "Analyze NVDA fundamentals", "Compare AAPL vs MSFT", "Research
        recent AI coding agents".
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: COLOR.axis,
            letterSpacing: '0.04em'
          }}
        >
          Return sends  ·  Shift+Enter newline  ·  Ctrl+L clears
        </div>
      </div>
    </div>
  );
}
