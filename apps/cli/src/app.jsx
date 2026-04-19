import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';

import {runResearchStream} from './api/client.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function App({query, apiUrl, sessionId}) {
  const {exit} = useApp();
  const [draft, setDraft] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState(query ?? null);
  const [status, setStatus] = useState(query ? 'connecting' : 'idle');
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [tick, setTick] = useState(0);
  const [finalOutput, setFinalOutput] = useState('');
  const bufferRef = useRef('');
  const bytesRef = useRef(0);
  const [bytes, setBytes] = useState(0);

  const resolvedApiUrl = useMemo(
    () =>
      apiUrl ??
      process.env.RESEARCH_AGENT_API_URL ??
      'http://localhost:7777',
    [apiUrl]
  );

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
      bytesRef.current = 0;
      setBytes(0);
      setFinalOutput('');
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
        bytesRef.current = 0;
        setBytes(0);
        setFinalOutput('');
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
      try {
        setStatus('running');

        for await (const chunk of runResearchStream(submittedQuery, {
          apiUrl: resolvedApiUrl,
          sessionId
        })) {
          if (cancelled) return;
          bufferRef.current += chunk;
          bytesRef.current += chunk.length;
          setBytes(bytesRef.current);
        }

        if (cancelled) return;
        setFinalOutput(extractFinalResponse(bufferRef.current));
        setStatus('done');
        if (query) {
          setTimeout(() => exit(), 50);
        }
      } catch (caught) {
        if (cancelled) return;
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
  }, [exit, query, resolvedApiUrl, sessionId, submittedQuery]);

  const spinner = SPINNER_FRAMES[tick % SPINNER_FRAMES.length];
  const seconds = (elapsed / 10).toFixed(1);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Header
        apiUrl={resolvedApiUrl}
        sessionId={sessionId}
        statusLabel={statusLabel}
        statusColor={statusColor}
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

      {!query && (
        <Box marginTop={1}>
          <PromptComposer draft={draft} disabled={isBusy} />
        </Box>
      )}
    </Box>
  );
}

function Header({apiUrl, sessionId, statusLabel, statusColor}) {
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

function QueryCard({query, isBusy, status, spinner, seconds, bytes, statusColor, finalOutput}) {
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

function tryParseJSON(text) {
  if (!text || (text[0] !== '{' && text[0] !== '[')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
