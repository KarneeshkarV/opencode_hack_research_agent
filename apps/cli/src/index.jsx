#!/usr/bin/env node

import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import {resolve} from 'node:path';

import {App} from './app.jsx';
import {readSseJsonlRunStart} from './api/replay.js';

const cli = meow(
  `
  Usage
    $ research-agent --query "Research AI coding agents"
    $ research-agent --replay ./research-agent-sse-events.jsonl

  Options
    --query, -q       Research question to send to the backend
    --api-url         Backend URL. Defaults to RESEARCH_AGENT_API_URL or http://localhost:7777
    --session-id      Optional Agno session id
    --ticker          Stock ticker for memory-layer persistence (overrides query auto-detection)
    --log-file        JSONL file for parsed SSE events. Defaults to one tmp/logs/research-agent-sse-events-<session>.jsonl file per CLI session unless RESEARCH_AGENT_SSE_LOG_FILE is set
    --debug-events    Show a live raw SSE event console in the terminal UI
    --replay          Replay a JSONL log for the first response only; follow-up prompts use the live API
    --replay-pacing   With --replay: fast (default), recorded (timestamps), or instant
    --once            Exit after the first completed response (non-interactive; for scripts)
  `,
  {
    importMeta: import.meta,
    flags: {
      query: {
        type: 'string',
        shortFlag: 'q'
      },
      apiUrl: {
        type: 'string'
      },
      sessionId: {
        type: 'string'
      },
      ticker: {
        type: 'string'
      },
      logFile: {
        type: 'string'
      },
      debugEvents: {
        type: 'boolean',
        default: false
      },
      replay: {
        type: 'string'
      },
      replayPacing: {
        type: 'string',
        default: 'fast'
      },
      once: {
        type: 'boolean',
        default: false
      }
    }
  }
);

const replayPath = cli.flags.replay ? resolve(cli.flags.replay) : null;

let replayMeta = null;
if (replayPath) {
  try {
    replayMeta = readSseJsonlRunStart(replayPath);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error(`Could not read replay file (${replayPath}): ${message}`);
    process.exit(1);
  }
  if (!replayMeta) {
    console.error(
      `Replay file must contain a run_start record as the first JSON line: ${replayPath}`
    );
    process.exit(1);
  }
}

const pacingOk = new Set(['fast', 'recorded', 'instant']);
const replayPacing = pacingOk.has(cli.flags.replayPacing)
  ? cli.flags.replayPacing
  : 'fast';

if (cli.input.length > 0) {
  console.error(
    `\nUnknown argument(s): ${cli.input.join(' ')}\n\n` +
      'Replay demo (from repo root):  bun run demo   or   bun cli demo\n' +
      'Also supported:                 bun run cli:demo\n\n' +
      'Do not pass stray tokens to tsx (e.g. run:demo) — use the scripts above.\n'
  );
  process.exit(1);
}

const initialQuery = cli.flags.query ?? replayMeta?.query ?? null;
const initialApiUrl = cli.flags.apiUrl ?? replayMeta?.apiUrl ?? null;
const initialSessionId = cli.flags.sessionId ?? replayMeta?.sessionId ?? null;

render(
  <App
    query={cli.flags.query}
    initialQuery={initialQuery}
    apiUrl={initialApiUrl}
    sessionId={initialSessionId}
    ticker={cli.flags.ticker}
    logFile={cli.flags.logFile}
    debugEvents={cli.flags.debugEvents}
    replayFile={replayPath}
    replayPacing={replayPacing}
    exitAfterRun={Boolean(cli.flags.once)}
  />
);
