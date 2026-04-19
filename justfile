set dotenv-load := true

api_host := env_var_or_default("AGENT_OS_HOST", "localhost")
api_port := env_var_or_default("AGENT_OS_PORT", "7777")

default:
    @just --list

install:
    bun install
    cd apps/api && uv sync

env:
    cp -n .env.example .env || true

dev:
    bun run dev

cli *args:
    cd apps/cli && bun run dev {{args}}

api:
    cd apps/api && uv run uvicorn research_agent.main:app --reload --host {{api_host}} --port {{api_port}} --log-level warning

api-test:
    cd apps/api && uv run pytest

eval:
    cd apps/api && uv run python scripts/run_evals.py

eval-one id:
    cd apps/api && uv run python scripts/run_evals.py --case {{id}}

cli-build:
    bun --filter @research-agent/cli build

cli-start:
    bun --filter @research-agent/cli start

lint:
    bun --filter @research-agent/cli lint
    cd apps/api && uv run ruff check .

format:
    bun --filter @research-agent/cli format
    cd apps/api && uv run ruff format .

check: lint api-test

logs:
    @latest="tmp/logs/api.latest.log"; if [ ! -e "$latest" ]; then latest="$(ls -t tmp/logs/api-*.log tmp/logs/api.log 2>/dev/null | head -n 1)"; fi; if [ -n "$latest" ]; then tail -f "$latest"; else echo "No logs found in tmp/logs"; exit 1; fi

clean:
    rm -rf node_modules apps/cli/node_modules apps/cli/dist
    rm -rf apps/api/.ruff_cache apps/api/.pytest_cache
    rm -rf tmp/logs
