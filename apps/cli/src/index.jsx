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
      }
    }
  }
);

render(
  <App
    query={cli.flags.query}
    apiUrl={cli.flags.apiUrl}
    sessionId={cli.flags.sessionId}
  />
);
