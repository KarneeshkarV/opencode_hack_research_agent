import {appendFileSync, mkdirSync, symlinkSync, unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';

import {runResearchStream} from './api/client.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_SSE_LOG_DIR = join(REPO_ROOT, 'tmp/logs');
const LATEST_SSE_LOG = join(DEFAULT_SSE_LOG_DIR, 'research-agent-sse-events.latest.jsonl');
const LOG_SESSION_ID = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${process.pid}`;

export function App({query, apiUrl, sessionId, logFile, ticker, debugEvents = false}) {
  const {exit} = useApp();
  const [draft, setDraft] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState(query ?? null);
  const [status, setStatus] = useState(query ? 'connecting' : 'idle');
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [tick, setTick] = useState(0);
  const [finalOutput, setFinalOutput] = useState('');
  const [intermediateSteps, setIntermediateSteps] = useState([]);
  const [eventConsole, setEventConsole] = useState([]);
  const [logError, setLogError] = useState(null);
  const bufferRef = useRef('');
  const sseBufferRef = useRef('');
  const runCounterRef = useRef(0);
  const sessionLogFileRef = useRef(null);
  const bytesRef = useRef(0);
  const [bytes, setBytes] = useState(0);
  const [activeLogFile, setActiveLogFile] = useState(null);

  const resolvedApiUrl = useMemo(
    () =>
      apiUrl ??
      process.env.RESEARCH_AGENT_API_URL ??
      'http://localhost:7777',
    [apiUrl]
  );

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
    if (query || isBusy) {
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
      setFinalOutput('');
      setIntermediateSteps([]);
      setEventConsole([]);
      setLogError(null);
      setActiveLogFile(null);
      return;
    }

    if (key.return) {
      const nextQuery = draft.trim();
      if (nextQuery.length > 0) {
        setError(null);
        setStatus('connecting');
        setSubmittedQuery(nextQuery);
        setDraft('');
        setElapsed(0);
        bufferRef.current = '';
        sseBufferRef.current = '';
        bytesRef.current = 0;
        setBytes(0);
        setFinalOutput('');
        setIntermediateSteps([]);
        setEventConsole([]);
        setLogError(null);
        setActiveLogFile(null);
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
    }, 100);
    return () => clearInterval(id);
  }, [isBusy]);

  useEffect(() => {
    if (!submittedQuery) return;

    let cancelled = false;

    async function run() {
      const runNumber = ++runCounterRef.current;
      const currentLogFile = configuredLogFile ?? getSessionLogFile(sessionLogFileRef);
      setActiveLogFile(currentLogFile);
      pointLatestSseLog(currentLogFile, setLogError);

      try {
        setStatus('running');
        logSseRecord(currentLogFile, {
          type: 'run_start',
          runNumber,
          query: submittedQuery,
          apiUrl: resolvedApiUrl,
          sessionId: sessionId ?? null
        }, setLogError);

        for await (const chunk of runResearchStream(submittedQuery, {
          apiUrl: resolvedApiUrl,
          sessionId,
          ticker
        })) {
          if (cancelled) return;
          bufferRef.current += chunk;
          bytesRef.current += chunk.length;
          setBytes(bytesRef.current);
          const parsed = parseSseEvents(sseBufferRef.current + chunk);
          sseBufferRef.current = parsed.remainder;

          for (const event of parsed.events) {
            logSseRecord(currentLogFile, {
              type: 'sse_event',
              runNumber,
              query: submittedQuery,
              event
            }, setLogError);
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
        setFinalOutput(extractFinalResponse(bufferRef.current));
        logSseRecord(currentLogFile, {
          type: 'run_end',
          runNumber,
          query: submittedQuery,
          status: 'done'
        }, setLogError);
        setStatus('done');
        if (query) {
          setTimeout(() => exit(), 50);
        }
      } catch (caught) {
        if (cancelled) return;
        logSseRecord(currentLogFile, {
          type: 'run_end',
          runNumber,
          query: submittedQuery,
          status: 'error',
          error: caught instanceof Error ? caught.message : String(caught)
        }, setLogError);
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        setStatus('error');
        if (query) {
          setTimeout(() => exit(caught), 50);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [configuredLogFile, exit, query, resolvedApiUrl, sessionId, submittedQuery]);

  const spinner = SPINNER_FRAMES[tick % SPINNER_FRAMES.length];
  const seconds = (elapsed / 10).toFixed(1);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Header
        apiUrl={resolvedApiUrl}
        sessionId={sessionId}
        statusLabel={statusLabel}
        statusColor={statusColor}
        logFile={logFileLabel}
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
            finalOutput={finalOutput}
            intermediateSteps={intermediateSteps}
            eventConsole={eventConsole}
            debugEvents={debugEvents}
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

      {!query && (
        <Box marginTop={1}>
          <PromptComposer draft={draft} disabled={isBusy} />
        </Box>
      )}
    </Box>
  );
}

function Header({apiUrl, sessionId, statusLabel, statusColor, logFile}) {
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text>
          <Text color="cyan" bold>◆ research-agent</Text>
          <Text color="gray"> · terminal workbench</Text>
        </Text>
        <Text>
          <Text color={statusColor}>●</Text>
          <Text color="gray"> {statusLabel}</Text>
        </Text>
      </Box>
      <Box>
        <Text color="gray">  {apiUrl}</Text>
        {sessionId && <Text color="gray">  ·  session {sessionId}</Text>}
      </Box>
      <Box>
        <Text color="gray">  sse log {logFile}</Text>
      </Box>
    </Box>
  );
}

function EmptyState() {
  return (
    <Box flexDirection="column">
      <Text bold>Ask for a research pass.</Text>
      <Text color="gray">
        Paste a task, compare options, or scope a focused investigation.
      </Text>
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
  finalOutput,
  intermediateSteps,
  eventConsole,
  debugEvents
}) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan" bold>❯ </Text>
        <Text>{query}</Text>
      </Box>

      <Box marginTop={1}>
        {isBusy ? (
          <Text>
            <Text color={statusColor}>{spinner}</Text>
            <Text color="gray"> working · {seconds}s</Text>
            {bytes > 0 && <Text color="gray"> · {formatBytes(bytes)} streamed</Text>}
          </Text>
        ) : status === 'done' ? (
          <Text>
            <Text color="green">✓</Text>
            <Text color="gray"> complete in {seconds}s{bytes > 0 ? ` · ${formatBytes(bytes)}` : ''}</Text>
          </Text>
        ) : status === 'error' ? (
          <Text color="red">✗ failed</Text>
        ) : null}
      </Box>

      {intermediateSteps.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow" bold>intermediate steps</Text>
          <Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column">
            {intermediateSteps.map(step => (
              <Text key={step.id}>
                <Text color={step.color}>{step.marker}</Text>
                <Text color="gray"> {step.label}</Text>
                <Text> {step.detail}</Text>
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {debugEvents && (
        <Box marginTop={1} flexDirection="column">
          <Text color="cyan" bold>sse event console</Text>
          <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
            {eventConsole.length > 0 ? (
              eventConsole.map(item => (
                <Text key={item.id}>
                  <Text color="cyan">{item.event}</Text>
                  <Text color="gray"> {item.summary}</Text>
                </Text>
              ))
            ) : (
              <Text color="gray">waiting for first SSE event from backend</Text>
            )}
          </Box>
        </Box>
      )}

      {status === 'done' && finalOutput && (
        <Box marginTop={1} flexDirection="column">
          <Text color="magenta" bold>agent</Text>
          <Box
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            flexDirection="column"
          >
            <Text>{finalOutput}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function PromptComposer({draft, disabled}) {
  const borderColor = disabled ? 'yellow' : 'cyan';
  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="column"
    >
      <Box>
        <Text color={borderColor}>{disabled ? '…' : '❯'}</Text>
        <Text> </Text>
        {disabled ? (
          <Text color="gray">waiting for the agent…</Text>
        ) : draft ? (
          <Text>
            {draft}
            <Text color="cyan">▎</Text>
          </Text>
        ) : (
          <Text color="gray">Type a query and press Return</Text>
        )}
      </Box>
      <Box justifyContent="space-between">
        <Text color="gray" dimColor>Return sends · Ctrl+L clears · Ctrl+C exits</Text>
      </Box>
    </Box>
  );
}

function Panel({title, borderColor, children}) {
  return (
    <Box borderStyle="round" borderColor={borderColor} flexDirection="column" paddingX={1}>
      <Text color={borderColor} bold>
        {title}
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
