#!/usr/bin/env bash
# Start the Agno/FastAPI backend and the Vite web app together.
# Mirrors scripts/dev.sh but launches the browser UI instead of the CLI.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_HOST="${AGENT_OS_HOST:-localhost}"
API_PORT="${AGENT_OS_PORT:-7777}"
LOG_DIR="$ROOT_DIR/tmp/logs"
RUN_ID="$(date +%Y%m%d-%H%M%S)-$$"
API_LOG="$LOG_DIR/api-$RUN_ID.log"
LATEST_LOG="$LOG_DIR/api.latest.log"

mkdir -p "$LOG_DIR"
ln -sfn "$(basename "$API_LOG")" "$LATEST_LOG"

cd "$ROOT_DIR/apps/api"
uv run uvicorn research_agent.main:app \
  --reload \
  --host "$API_HOST" \
  --port "$API_PORT" \
  --log-level warning \
  >"$API_LOG" 2>&1 &
API_PID=$!

cleanup() {
  kill "$API_PID" >/dev/null 2>&1 || true
  wait "$API_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

export RESEARCH_AGENT_API_URL="${RESEARCH_AGENT_API_URL:-http://$API_HOST:$API_PORT}"
cd "$ROOT_DIR/apps/web"
bun run dev "$@"
