import {appendFileSync, mkdirSync, symlinkSync, unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import Gradient from 'ink-gradient';
import gradient from 'gradient-string';

import {fetchSessionCost, runResearchStream} from './api/client.js';
import {replayFromSseJsonl} from './api/replay.js';
import {BloombergWorkbench} from './bloomberg-workbench.jsx';
import {PromptComposer} from './prompt-composer.jsx';
import {extractTickerHint} from './ticker-guess.js';
import {prepareResearchMessage} from './ticker-context.js';
import {
  BRAND_GRADIENT,
  TAGLINE_GRADIENT,
  QUERY_ARROW_GRADIENT,
  STEPS_GRADIENT,
  CONSOLE_GRADIENT,
  COLOR
} from './theme.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_SSE_LOG_DIR = join(REPO_ROOT, 'tmp/logs');
const LATEST_SSE_LOG = join(DEFAULT_SSE_LOG_DIR, 'research-agent-sse-events.latest.jsonl');
const LOG_SESSION_ID = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${process.pid}`;

export function App({
  query,
  initialQuery,
  apiUrl,
  sessionId,
  logFile,
  ticker,
  debugEvents = false,
  replayFile = null,
  replayPacing = 'fast',
  exitAfterRun = false
}) {
  const {exit} = useApp();
  const interactive = !exitAfterRun;
  const resolvedInitialQuery = initialQuery ?? query ?? null;
  const [draft, setDraft] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState(resolvedInitialQuery);
  const [status, setStatus] = useState(resolvedInitialQuery ? 'connecting' : 'idle');
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [tick, setTick] = useState(0);
  const [intermediateSteps, setIntermediateSteps] = useState([]);
  const [eventConsole, setEventConsole] = useState([]);
  const [logError, setLogError] = useState(null);
  const [costSummary, setCostSummary] = useState(null);
  const bufferRef = useRef('');
  const sseBufferRef = useRef('');
  const runCounterRef = useRef(0);
  const sessionLogFileRef = useRef(null);
  const bytesRef = useRef(0);
  const lastBytesFlushRef = useRef(0);
  const [bytes, setBytes] = useState(0);
  const [activeLogFile, setActiveLogFile] = useState(null);
  const [snapshotFinished, setSnapshotFinished] = useState(false);
  const [chatTurns, setChatTurns] = useState([]);
  const [chatScroll, setChatScroll] = useState(0);
  const [runNonce, setRunNonce] = useState(0);
  const replayConsumedRef = useRef(false);

  const handleSnapshotFinished = useCallback(() => {
    setSnapshotFinished(true);
  }, []);

  useEffect(() => {
    const max = Math.max(0, chatTurns.length - 1);
    setChatScroll(s => Math.min(s, max));
  }, [chatTurns.length]);

  const resolvedApiUrl = useMemo(
    () =>
      apiUrl ??
      process.env.RESEARCH_AGENT_API_URL ??
      'http://localhost:7777',
    [apiUrl]
  );

  const effectiveSessionId = sessionId || LOG_SESSION_ID;

  const configuredLogFile = useMemo(
    () => logFile ?? process.env.RESEARCH_AGENT_SSE_LOG_FILE ?? null,
    [logFile]
  );

  const logFileLabel =
    activeLogFile ??
    configuredLogFile ??
    join(DEFAULT_SSE_LOG_DIR, 'research-agent-sse-events-<session>.jsonl');

  const isBusy = status === 'running' || status === 'connecting';

  const statusColor = useMemo(() => {
    if (status === 'error') return 'red';
    if (isBusy) return 'yellow';
    if (status === 'done') return 'green';
    return 'gray';
  }, [status, isBusy]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'connecting':
        return 'connecting';
      case 'running':
        return 'researching';
      case 'done':
        return 'ready';
      case 'error':
        return 'error';
      default:
        return 'idle';
    }
  }, [status]);

  useInput((input, key) => {
    if (isBusy) {
      return;
    }

    if (key.ctrl && input === 'l') {
      setSubmittedQuery(null);
      setError(null);
      setStatus('idle');
      setElapsed(0);
      bufferRef.current = '';
      sseBufferRef.current = '';
      bytesRef.current = 0;
      setBytes(0);
      setChatTurns([]);
      setChatScroll(0);
      setRunNonce(0);
      setIntermediateSteps([]);
      setEventConsole([]);
      setLogError(null);
      setActiveLogFile(null);
      setCostSummary(null);
      replayConsumedRef.current = false;
      return;
    }

    if (
      interactive &&
      chatTurns.length > 0 &&
      draft === '' &&
      (input === 'j' || input === 'k')
    ) {
      const maxScroll = Math.max(0, chatTurns.length - 1);
      if (input === 'j') {
        setChatScroll(s => Math.min(maxScroll, s + 1));
      } else {
        setChatScroll(s => Math.max(0, s - 1));
      }
      return;
    }

    if (key.return) {
      const nextQuery = draft.trim();
      if (nextQuery.length > 0) {
        setError(null);
        setStatus('connecting');
        setSnapshotFinished(false);
        setRunNonce(n => n + 1);
        setSubmittedQuery(nextQuery);
        setDraft('');
        setElapsed(0);
        bufferRef.current = '';
        sseBufferRef.current = '';
        bytesRef.current = 0;
        setBytes(0);
        setIntermediateSteps([]);
        setEventConsole([]);
        setLogError(null);
        setActiveLogFile(null);
        setCostSummary(null);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setDraft(current => current.slice(0, -1));
      return;
    }

    if (input) {
      setDraft(current => current + input);
    }
  });

  useEffect(() => {
    if (!isBusy) return;
    const id = setInterval(() => {
      setTick(t => t + 1);
      setElapsed(e => e + 1);
    }, 200);
    return () => clearInterval(id);
  }, [isBusy]);

  useEffect(() => {
    if (status !== 'done' || interactive) return;
    const hint = extractTickerHint(
      '',
      chatTurns.map(t => t.assistant).join('\n\n')
    );
    if (!hint) {
      const t = setTimeout(() => exit(), 100);
      return () => clearTimeout(t);
    }
    if (snapshotFinished) {
      const t = setTimeout(() => exit(), 200);
      return () => clearTimeout(t);
    }
    const maxWait = setTimeout(() => exit(), 30000);
    return () => clearTimeout(maxWait);
  }, [status, interactive, chatTurns, snapshotFinished, exit]);

  useEffect(() => {
    if (!submittedQuery) return;

    let cancelled = false;
    const userPrompt = submittedQuery;

    async function run() {
      const runNumber = ++runCounterRef.current;
      const currentLogFile =
        configuredLogFile ?? getSessionLogFile(sessionLogFileRef);
      const useReplay = Boolean(replayFile && !replayConsumedRef.current);
      const writingLog = !useReplay;

      if (useReplay) {
        setActiveLogFile(replayFile);
      } else {
        setActiveLogFile(currentLogFile);
        pointLatestSseLog(currentLogFile, setLogError);
      }

      try {
        setStatus('running');

        // Only resolve ticker context for live (non-replay) runs; replay files
        // already contain the original run's prepared message.
        let prepared = null;
        if (!useReplay) {
          prepared = await prepareResearchMessage(userPrompt, {
            explicitTicker: ticker
          });

          if (cancelled) return;
        }

        if (writingLog) {
          logSseRecord(currentLogFile, {
            type: 'run_start',
            runNumber,
            query: userPrompt,
            resolvedTicker: prepared?.ticker ?? null,
            resolvedTickers: prepared?.resolution?.tickers ?? [],
            tickerResolutionSource: prepared?.resolution?.source ?? null,
            sector: prepared?.sector || null,
            memoryPeers: (prepared?.memoryPeers ?? []).map(peer => ({
              ticker: peer.ticker,
              runId: peer.runId,
              sector: peer.sector
            })),
            apiUrl: resolvedApiUrl,
            sessionId: effectiveSessionId
          }, setLogError);
        }

        const stream = useReplay
          ? replayFromSseJsonl(replayFile, {pacing: replayPacing})
          : runResearchStream(prepared.message, {
              apiUrl: resolvedApiUrl,
              sessionId: effectiveSessionId,
              ticker: prepared.ticker ?? ticker
            });

        for await (const chunk of stream) {
          if (cancelled) return;
          bufferRef.current += chunk;
          bytesRef.current += chunk.length;
          const nowMs = Date.now();
          if (nowMs - lastBytesFlushRef.current > 250) {
            lastBytesFlushRef.current = nowMs;
            setBytes(bytesRef.current);
          }
          const parsed = parseSseEvents(sseBufferRef.current + chunk);
          sseBufferRef.current = parsed.remainder;

          if (writingLog) {
            for (const event of parsed.events) {
              logSseRecord(currentLogFile, {
                type: 'sse_event',
                runNumber,
                query: userPrompt,
                event
              }, setLogError);
            }
          }

          if (debugEvents && parsed.events.length > 0) {
            const nextConsoleEvents = parsed.events.map(formatConsoleEvent);
            setEventConsole(current => [...current, ...nextConsoleEvents].slice(-12));
          }

          const nextSteps = parsed.events
            .map(formatIntermediateStep)
            .filter(Boolean);

          if (nextSteps.length > 0) {
            setIntermediateSteps(current => mergeRecentSteps(current, nextSteps));
          }
        }

        if (cancelled) return;
        setBytes(bytesRef.current);
        const assistant = extractFinalResponse(bufferRef.current);
        setChatTurns(prev => [...prev, {user: userPrompt, assistant}]);
        if (useReplay) {
          replayConsumedRef.current = true;
        }
        if (writingLog) {
          logSseRecord(currentLogFile, {
            type: 'run_end',
            runNumber,
            query: userPrompt,
            status: 'done'
          }, setLogError);
        }
        setStatus('done');

        if (!useReplay) {
          fetchSessionCost(effectiveSessionId, {apiUrl: resolvedApiUrl})
            .then(summary => {
              if (cancelled) return;
              setCostSummary(summary);
              if (writingLog) {
                logSseRecord(currentLogFile, {
                  type: 'session_cost',
                  runNumber,
                  sessionId: effectiveSessionId,
                  summary
                }, setLogError);
              }
            })
            .catch(() => {});
        }
      } catch (caught) {
        if (cancelled) return;
        if (writingLog) {
          logSseRecord(currentLogFile, {
            type: 'run_end',
            runNumber,
            query: userPrompt,
            status: 'error',
            error: caught instanceof Error ? caught.message : String(caught)
          }, setLogError);
        }
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        setStatus('error');
        if (!interactive) {
          setTimeout(() => exit(caught), 50);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [
    configuredLogFile,
    effectiveSessionId,
    exit,
    interactive,
    replayFile,
    replayPacing,
    resolvedApiUrl,
    submittedQuery,
    ticker,
    runNonce
  ]);

  const spinner = SPINNER_FRAMES[tick % SPINNER_FRAMES.length];
  const seconds = (elapsed / 5).toFixed(1);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Header
        apiUrl={resolvedApiUrl}
        sessionId={effectiveSessionId}
        statusLabel={statusLabel}
        statusColor={statusColor}
        logFile={logFileLabel}
        replayMode={Boolean(replayFile)}
      />

      <Box marginTop={1} flexDirection="column">
        {!submittedQuery ? (
          <EmptyState />
        ) : (
          <QueryCard
            query={submittedQuery}
            isBusy={isBusy}
            status={status}
            spinner={spinner}
            seconds={seconds}
            bytes={bytes}
            statusColor={statusColor}
            chatTurns={chatTurns}
            chatScroll={chatScroll}
            intermediateSteps={intermediateSteps}
            eventConsole={eventConsole}
            debugEvents={debugEvents}
            costSummary={costSummary}
            onSnapshotFinished={handleSnapshotFinished}
            interactive={interactive}
            draft={draft}
          />
        )}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Panel title="error" borderColor="red">
            <Text color="red">{error.message}</Text>
          </Panel>
        </Box>
      )}

      {logError && (
        <Box marginTop={1}>
          <Panel title="sse log" borderColor="yellow">
            <Text color="yellow">{logError}</Text>
          </Panel>
        </Box>
      )}

      {interactive && !submittedQuery && (
        <Box marginTop={1}>
          <PromptComposer draft={draft} disabled={isBusy} />
        </Box>
      )}
    </Box>
  );
}

const taglineGradient = gradient(TAGLINE_GRADIENT);

const STATUS_ICON = {
  idle: '○',
  connecting: '◌',
  running: '◉',
  done: '◆',
  error: '✖',
};

function Header({apiUrl, sessionId, statusLabel, statusColor, logFile, replayMode}) {
  const icon = STATUS_ICON[statusLabel] ?? '○';
  return (
    <Box flexDirection="column">
      {/* ── top bar ── */}
      <Box justifyContent="space-between" alignItems="center">
        <Box flexDirection="row" alignItems="center" gap={0}>
          <Text bold>
            <Gradient colors={BRAND_GRADIENT}>▲ RESEARCH AGENT</Gradient>
          </Text>
          <Text>{taglineGradient('  ·  neon aurora terminal')}</Text>
        </Box>
        <Box flexDirection="row" alignItems="center">
          <Text color={statusColor} bold>{icon}</Text>
          <Text color={COLOR.meta}> {statusLabel.toUpperCase()}</Text>
        </Box>
      </Box>
      {/* ── meta row ── */}
      <Box flexDirection="row" gap={0}>
        <Text color={COLOR.meta}>  ⬡ {apiUrl}</Text>
        {sessionId && <Text color={COLOR.meta}>  ·  ⧖ {sessionId}</Text>}
        {replayMode && <Text color={COLOR.busyBorder}>  ⏪ REPLAY</Text>}
      </Box>
      <Box>
        <Text color={COLOR.axis}>  {'─'.repeat(4)} {replayMode ? 'source' : 'log'}: {logFile}</Text>
      </Box>
    </Box>
  );
}

function EmptyState() {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row" alignItems="center">
        <Text bold>
          <Gradient colors={BRAND_GRADIENT}>◈ Ready for a deep research pass.</Gradient>
        </Text>
      </Box>
      <Box marginTop={0}>
        <Text color={COLOR.body}>  Paste a task · compare options · scope an investigation</Text>
      </Box>
      <Box marginTop={1} borderStyle="round" borderColor={COLOR.meta} paddingX={2} paddingY={0}>
        <Text color={COLOR.meta}>
          Return sends  ·  j/k scrolls chat  ·  Ctrl+L clears  ·  Ctrl+C exits
        </Text>
      </Box>
    </Box>
  );
}

function QueryCard({
  query,
  isBusy,
  status,
  spinner,
  seconds,
  bytes,
  statusColor,
  chatTurns,
  chatScroll,
  intermediateSteps,
  eventConsole,
  debugEvents,
  costSummary,
  onSnapshotFinished,
  interactive,
  draft
}) {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" alignItems="center">
        <Text bold>
          <Gradient colors={QUERY_ARROW_GRADIENT}>❯ </Gradient>
        </Text>
        <Text bold color={COLOR.text}>{query}</Text>
      </Box>

      <Box marginTop={0}>
        {isBusy ? (
          <Text>
            <Text color={statusColor} bold>{spinner}</Text>
            <Text color={COLOR.body}>  researching · {seconds}s</Text>
            {bytes > 0 && <Text color={COLOR.meta}>  ·  {formatBytes(bytes)} streamed</Text>}
          </Text>
        ) : status === 'done' ? (
          <Text>
            <Text color={COLOR.up} bold>✔</Text>
            <Text color={COLOR.body}>  done in {seconds}s</Text>
            {bytes > 0 && <Text color={COLOR.meta}>  ·  {formatBytes(bytes)}</Text>}
          </Text>
        ) : status === 'error' ? (
          <Text color={COLOR.down} bold>✖ failed</Text>
        ) : null}
      </Box>

      {status === 'done' && costSummary && (
        <Box>
          <Text color="gray">{formatCostSummary(costSummary)}</Text>
        </Box>
      )}

      {intermediateSteps.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Box flexDirection="row" alignItems="center" marginBottom={0}>
            <Text bold>
              <Gradient colors={STEPS_GRADIENT}>⚡ STEPS</Gradient>
            </Text>
          </Box>
          <Box borderStyle="round" borderColor={COLOR.busyBorder} paddingX={1} flexDirection="column">
            {intermediateSteps.map(step => (
              <Text key={step.id}>
                <Text color={step.color} bold>{step.marker}</Text>
                <Text color={COLOR.sectionHead}>  {step.label}</Text>
                <Text color={COLOR.body}>  {step.detail}</Text>
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {debugEvents && (
        <Box marginTop={1} flexDirection="column">
          <Text bold>
            <Gradient colors={CONSOLE_GRADIENT}>⬡ SSE CONSOLE</Gradient>
          </Text>
          <Box borderStyle="round" borderColor={COLOR.divider} paddingX={1} flexDirection="column">
            {eventConsole.length > 0 ? (
              eventConsole.map(item => (
                <Text key={item.id}>
                  <Text color={COLOR.sectionHead} bold>{item.event}</Text>
                  <Text color={COLOR.body}>  {item.summary}</Text>
                </Text>
              ))
            ) : (
              <Text color={COLOR.meta}>waiting for first SSE event from backend…</Text>
            )}
          </Box>
        </Box>
      )}

      {query && (isBusy || chatTurns.length > 0) && (
        <Box marginTop={1} flexDirection="column">
          <BloombergWorkbench
            assistantMarkdown={chatTurns.map(t => t.assistant).join('\n\n')}
            chatTurns={chatTurns}
            chatScroll={chatScroll}
            isBusy={isBusy}
            interactive={interactive}
            draft={draft}
            onSnapshotFinished={onSnapshotFinished}
            costSummary={costSummary}
          />
        </Box>
      )}
    </Box>
  );
}

function Panel({title, borderColor, children}) {
  return (
    <Box borderStyle="round" borderColor={borderColor} flexDirection="column" paddingX={1}>
      <Text color={borderColor} bold>
        ◈ {title.toUpperCase()}
      </Text>
      {children}
    </Box>
  );
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCostSummary(summary) {
  const parts = [];
  const total = summary?.cost_usd?.total;
  if (typeof total === 'number' && total > 0) {
    parts.push(`cost $${total.toFixed(4)}`);
  }
  if (typeof summary?.tokens === 'number' && summary.tokens > 0) {
    parts.push(`${summary.tokens.toLocaleString()} tokens`);
  }
  if (typeof summary?.latency_seconds === 'number' && summary.latency_seconds > 0) {
    parts.push(`${summary.latency_seconds.toFixed(1)}s traced`);
  }
  const orders = Array.isArray(summary?.orders) ? summary.orders.length : 0;
  if (orders > 0) {
    const charges = summary.total_order_charges_inr ?? 0;
    parts.push(`${orders} order${orders > 1 ? 's' : ''} · charges ₹${charges.toFixed(2)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'no cost data yet';
}

function extractFinalResponse(raw) {
  if (!raw) return '';

  const trimmed = raw.trim();

  const events = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate) continue;
    const json = tryParseJSON(candidate) ?? tryParseJSON(stripSsePrefix(candidate));
    if (json) events.push(json);
  }

  if (events.length > 0) {
    const completed = [...events].reverse().find(e => {
      const ev = (e.event ?? e.type ?? '').toString().toLowerCase();
      return ev.includes('completed') || ev.includes('final') || ev === 'runresponse';
    });
    const source = completed ?? events[events.length - 1];
    const content = source?.content ?? source?.message ?? source?.response;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (content && typeof content === 'object' && typeof content.content === 'string') {
      return content.content.trim();
    }
  }

  return trimmed;
}

function stripSsePrefix(line) {
  if (line.startsWith('data:')) return line.slice(5).trim();
  return line;
}

function parseSseEvents(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const chunks = normalized.split('\n\n');
  const remainder = chunks.pop() ?? '';
  const events = [];

  for (const chunk of chunks) {
    const event = parseSseEvent(chunk);
    if (event) events.push(event);
  }

  return {events, remainder};
}

function logSseRecord(logFile, record, onError) {
  try {
    mkdirSync(dirname(logFile), {recursive: true});
    appendFileSync(
      logFile,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        ...record
      })}\n`,
      'utf8'
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    onError(`Could not write SSE log to ${logFile}: ${message}`);
  }
}

function getSessionLogFile(sessionLogFileRef) {
  sessionLogFileRef.current ??= join(
    DEFAULT_SSE_LOG_DIR,
    `research-agent-sse-events-${LOG_SESSION_ID}.jsonl`
  );
  return sessionLogFileRef.current;
}

function pointLatestSseLog(logFile, onError) {
  try {
    mkdirSync(dirname(LATEST_SSE_LOG), {recursive: true});
    try {
      unlinkSync(LATEST_SSE_LOG);
    } catch (caught) {
      if (!caught || caught.code !== 'ENOENT') {
        throw caught;
      }
    }
    symlinkSync(logFile, LATEST_SSE_LOG);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    onError(`Could not update latest SSE log link ${LATEST_SSE_LOG}: ${message}`);
  }
}

function parseSseEvent(chunk) {
  let eventName = 'message';
  const dataLines = [];

  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;

  const data = dataLines.join('\n');
  const parsed = tryParseJSON(data);
  if (!parsed) return null;

  return {
    ...parsed,
    event: parsed.event ?? eventName
  };
}

function formatConsoleEvent(event) {
  const eventName = (event.event ?? event.type ?? 'message').toString();
  const keys = Object.keys(event)
    .filter(key => !['event', 'content'].includes(key))
    .slice(0, 6);
  const content = summarizeContent(event.content);
  const summaryParts = [];

  if (event.agent_name || event.agent_id) {
    summaryParts.push(`agent=${event.agent_name ?? event.agent_id}`);
  }
  if (event.team_name || event.team_id) {
    summaryParts.push(`team=${event.team_name ?? event.team_id}`);
  }
  if (event.tool) {
    summaryParts.push(`tool=${toolName(event)}`);
  }
  if (content !== 'received') {
    summaryParts.push(`content=${truncate(content, 80)}`);
  }
  if (keys.length > 0) {
    summaryParts.push(`keys=${keys.join(',')}`);
  }

  return {
    id: [
      event.run_id,
      event.created_at,
      eventName,
      JSON.stringify(summaryParts)
    ].join(':'),
    event: eventName,
    summary: truncate(summaryParts.join(' · ') || 'received', 160)
  };
}

function formatIntermediateStep(event) {
  const name = (event.event ?? event.type ?? '').toString();
  if (!name || isContentDeltaEvent(name)) return null;

  const lower = name.toLowerCase();
  const actor = event.agent_name ?? event.team_name ?? event.agent_id ?? event.team_id;

  if (lower.includes('runstarted')) {
    return buildStep(event, 'start', 'cyan', 'started', actor ?? 'run started');
  }

  if (lower.includes('modelrequeststarted')) {
    return buildStep(event, 'model', 'cyan', 'model', event.model ?? 'request started');
  }

  if (lower.includes('modelrequestcompleted')) {
    const tokens = event.total_tokens ? `${event.total_tokens} tokens` : 'request completed';
    return buildStep(event, 'model', 'green', 'model', tokens);
  }

  if (lower.includes('toolcallstarted')) {
    return buildStep(event, 'tool', 'yellow', 'tool started', toolName(event));
  }

  if (lower.includes('toolcallcompleted')) {
    return buildStep(event, 'tool', 'green', 'tool completed', toolName(event));
  }

  if (lower.includes('toolcallerror')) {
    return buildStep(event, 'tool', 'red', 'tool error', event.error ?? toolName(event));
  }

  if (lower.includes('intermediatecontent')) {
    return buildStep(event, 'note', 'yellow', 'update', summarizeContent(event.content));
  }

  if (lower.includes('reasoningstarted')) {
    return buildStep(event, 'think', 'cyan', 'reasoning', 'started');
  }

  if (lower.includes('reasoningstep')) {
    return buildStep(event, 'think', 'yellow', 'reasoning', summarizeContent(event.content));
  }

  if (lower.includes('reasoningcompleted')) {
    return buildStep(event, 'think', 'green', 'reasoning', 'completed');
  }

  if (lower.includes('runcompleted')) {
    return buildStep(event, 'done', 'green', 'completed', actor ?? 'run completed');
  }

  if (lower.includes('runerror')) {
    return buildStep(event, 'error', 'red', 'error', summarizeContent(event.content));
  }

  return null;
}

function isContentDeltaEvent(name) {
  const lower = name.toLowerCase();
  return (
    lower === 'teamruncontent' ||
    lower === 'runcontent' ||
    lower.includes('contentdelta') ||
    lower.includes('contentcompleted')
  );
}

function buildStep(event, marker, color, label, detail) {
  return {
    id: [
      event.run_id,
      event.created_at,
      event.event,
      label,
      typeof detail === 'string' ? detail : JSON.stringify(detail)
    ].join(':'),
    marker,
    color,
    label,
    detail: truncate(String(detail || 'received'), 120)
  };
}

function toolName(event) {
  const tool = event.tool ?? {};
  return (
    tool.tool_name ??
    tool.function?.name ??
    tool.name ??
    tool.tool_call_id ??
    'tool call'
  );
}

function summarizeContent(content) {
  if (typeof content === 'string') return content.trim() || 'received';
  if (!content) return 'received';
  if (typeof content === 'object') {
    return content.title ?? content.name ?? content.status ?? JSON.stringify(content);
  }
  return String(content);
}

function mergeRecentSteps(current, next) {
  const merged = [...current];
  for (const step of next) {
    if (merged[merged.length - 1]?.id !== step.id) {
      merged.push(step);
    }
  }
  return merged.slice(-8);
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function tryParseJSON(text) {
  if (!text || (text[0] !== '{' && text[0] !== '[')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
