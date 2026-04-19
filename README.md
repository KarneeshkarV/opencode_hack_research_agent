# OpenCode Hack Research Agent

Monorepo for a terminal research assistant:

- `apps/cli`: Ink/React command line frontend
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

Each CLI research run writes parsed SSE events to a separate JSONL file:

```txt
tmp/logs/research-agent-sse-events-<timestamp>-<pid>-<run>.jsonl
```

The latest CLI run log is also available at `tmp/logs/research-agent-sse-events.latest.jsonl`.

## Commands

```bash
bun run cli        # run the Ink app
bun run api:dev    # run the Agno/FastAPI backend
bun run api:test   # run backend tests
bun run lint       # lint JS and Python workspaces
bun run format     # format JS and Python workspaces
```

## Environment

```txt
RESEARCH_AGENT_API_URL=http://localhost:7777
AGENT_OS_HOST=localhost
AGENT_OS_PORT=7777
AGNO_MODEL_ID=gpt-5.2
OPENAI_API_KEY=
```
