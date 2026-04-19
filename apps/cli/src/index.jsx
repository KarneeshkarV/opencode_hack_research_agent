#!/usr/bin/env node

import React from 'react';
import {render} from 'ink';
import meow from 'meow';

import {App} from './app.jsx';

const cli = meow(
  `
  Usage
    $ research-agent --query "Research AI coding agents"

  Options
    --query, -q       Research question to send to the backend
    --api-url         Backend URL. Defaults to RESEARCH_AGENT_API_URL or http://localhost:7777
    --session-id      Optional Agno session id
    --log-file        JSONL file for parsed SSE events. Defaults to a new tmp/logs/research-agent-sse-events-<timestamp>-<pid>-<run>.jsonl file per run unless RESEARCH_AGENT_SSE_LOG_FILE is set
    --debug-events    Show a live raw SSE event console in the terminal UI
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
      logFile: {
        type: 'string'
      },
      debugEvents: {
        type: 'boolean',
        default: false
      }
    }
  }
);

render(
  <App
    query={cli.flags.query}
    apiUrl={cli.flags.apiUrl}
    sessionId={cli.flags.sessionId}
    logFile={cli.flags.logFile}
    debugEvents={cli.flags.debugEvents}
  />
);
