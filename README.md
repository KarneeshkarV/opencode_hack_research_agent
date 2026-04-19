# OpenCode Hack Trading + Research Agent

A terminal-native trading and research assistant. A coordinator team of specialized Agno agents researches markets, reasons over fundamentals, technicals, macro, and risk, and can place live orders on Zerodha Kite — all driven from an Ink/React CLI that renders a Bloomberg-style workbench.

- `apps/cli`: Ink/React terminal UI — prompt composer, trading chart, ticker context, right-side blotter
- `apps/api`: Agno + FastAPI backend hosting the research/execution team
- `packages/contracts`: generated API contracts and client artifacts

Runtime boundary:

```txt
Ink CLI (workbench) -> HTTP/SSE -> Agno team (research + execution) -> Kite / market data
```

## Why a terminal, not a web app

The surface is deliberate. Traders already live in terminal-first tools (Bloomberg, Eikon, tmux, Vim) because latency, keyboard throughput, and signal density matter more than onboarding flow. This product targets that operator — not an HR-style role-configuration workflow — so the UI budget went into a Bloomberg-grade workbench (ticker context, live chart, right-side blotter, streamed reasoning steps) rather than a management console.

Concretely:

- **Operator surface, not management surface.** The Ink workbench is for running research and placing orders. Defining new specialist agents is done in code (`apps/api/src/research_agent/agents/financial_research.py`) — that path is versioned and reviewable, not click-ops.
- **Keyboard-only by design.** `j/k` scrolls chat, `Ctrl+L` clears, `Return` submits. No mouse round-trips between idea and order.
- **SSE-native.** Every reasoning step, tool call, and delta streams back in real time; the workbench renders partials as they arrive instead of waiting on a final payload.

If you need a non-engineer to onboard a new agent role without touching Python, this repo isn't it yet — that belongs in a separate admin surface and is an explicit non-goal for v1.

## What the agent can do

The coordinator routes each turn to the right specialists and streams their reasoning back to the CLI.

**Research**

- **Company Financial Research** — filings, news, market research on a ticker
- **Macro Economic** — rates, indices, sector flows, global context
- **Term Sheet** — parse and reason over deal docs
- **Technical Analysis** — indicators, trend, support/resistance via `get_technical_summary`
- **Fundamental Analysis** — ratios, growth, quality, valuation
- **Risk Management** — position sizing, exposure, drawdown checks

**Trading (Zerodha Kite)**

- Account/profile, holdings, positions, margins, LTP
- Place regular orders and GTTs through the Execution agent
- `KITE_DRY_RUN=true` by default — flip to `false` only when you mean it

Prior runs are persisted to on-disk memory so follow-up questions stay contextual.

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

Set `OPENAI_API_KEY` for the Agno model. Add `KITE_API_KEY`, `KITE_API_SECRET`, `KITE_ACCESS_TOKEN` to enable Kite — keep `KITE_DRY_RUN=true` while you iterate.

## Development

Run the API:

```bash
bun run api:dev
```

In another terminal, run the CLI:

```bash
bun run cli --query "Scan RELIANCE: fundamentals, technicals, and a sized entry plan"
```

Or run both together:

```bash
bun run dev
```

The dev runner keeps the terminal focused on the Ink workbench. API logs are written to:

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
bun run cli        # run the Ink workbench
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
EXTERNAL_TOOL_TIMEOUT_SECONDS=25
RESEARCH_AGENT_STREAM_IDLE_TIMEOUT_MS=90000
OPENAI_API_KEY=
EXA_API_KEY=

# Zerodha Kite — required to trade
KITE_API_KEY=
KITE_API_SECRET=
KITE_ACCESS_TOKEN=
KITE_DRY_RUN=true

# Langfuse observability (optional)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://us.cloud.langfuse.com
LANGFUSE_ENABLED=true
ENVIRONMENT=dev
```

> Safety: live order placement is gated by `KITE_DRY_RUN`. Leave it `true` unless you have reviewed the execution path and intend to trade real capital.
