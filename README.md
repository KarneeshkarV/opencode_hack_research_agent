# OpenCode Hack Research Agent

Monorepo for a terminal research assistant:

- `apps/cli`: Ink/React command line frontend
- `apps/web`: Vite/React browser frontend (same UX as the CLI, for the web)
- `apps/api`: Agno + FastAPI backend
- `packages/contracts`: generated API contracts and client artifacts

Runtime boundary:

```txt
Ink CLI -> HTTP API -> Agno/FastAPI backend
```

## Prerequisites

- Node.js 20+
- Bun 1+
- Python 3.11+
- uv

## Setup

```bash
bun install
cd apps/api
uv sync
```

Create a local environment file:

```bash
cp .env.example .env
```

Set `OPENAI_API_KEY` if you use the default OpenAI-backed Agno model.

## Development

Run the API:

```bash
bun run api:dev
```

In another terminal, run the CLI:

```bash
bun run cli --query "Find recent work on AI coding agents"
```

Or run both processes together:

```bash
bun run dev
```

The dev runner keeps the terminal focused on the Ink UI. API logs are written to:

```txt
tmp/logs/api-<timestamp>-<pid>.log
```

The latest API run is also available at `tmp/logs/api.latest.log`.

Each CLI session writes parsed SSE events to a single JSONL file, with multiple runs appended to the same file:

```txt
tmp/logs/research-agent-sse-events-<session>.jsonl
```

The latest CLI session log is also available at `tmp/logs/research-agent-sse-events.latest.jsonl`.

## Commands

```bash
bun run cli        # run the Ink app
bun run web        # run the web UI (Vite dev server @ http://localhost:5173)
bun run web:dev    # run API + web UI together
bun run web:build  # build web UI for production
bun run api:dev    # run the Agno/FastAPI backend
bun run api:test   # run backend tests
bun run lint       # lint JS and Python workspaces
bun run format     # format JS and Python workspaces
```

## Web UI

The web app mirrors the terminal CLI inside the browser — same neon aurora
theme, same chat + intermediate steps + blotter/market snapshot. It talks to
the backend via the Vite dev proxy (`/api` → `RESEARCH_AGENT_API_URL`), so
there's no CORS setup required.

```bash
bun run web:dev    # starts API + web together; open http://localhost:5173
```

## Environment

```txt
RESEARCH_AGENT_API_URL=http://localhost:7777
AGENT_OS_HOST=localhost
AGENT_OS_PORT=7777
AGNO_MODEL_ID=gpt-5.2
EXTERNAL_TOOL_TIMEOUT_SECONDS=25
RESEARCH_AGENT_STREAM_IDLE_TIMEOUT_MS=90000
OPENAI_API_KEY=
EXA_API_KEY=
```
