#!/usr/bin/env bash
# Invoked as the root "cli" script. Supports:
#   bun cli              → apps/cli dev (interactive)
#   bun cli demo         → replay demo (same as bun run demo)
#   bun cli run:demo     → alias for demo (common typo)
#   bun cli --replay …   → forwarded to tsx
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI_DIR="$ROOT/apps/cli"

case "${1:-}" in
  demo|run:demo)
    cd "$CLI_DIR" && exec bun run demo
    ;;
  "")
    cd "$CLI_DIR" && exec bun run dev
    ;;
  *)
    cd "$CLI_DIR" && exec bunx tsx src/index.jsx "$@"
    ;;
esac
