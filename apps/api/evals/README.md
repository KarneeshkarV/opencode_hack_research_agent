# Research-agent eval harness

A black-box evaluator for the financial-research team. Drives the real
HTTP streaming endpoint (`POST /teams/financial-research-team/runs`),
parses the SSE stream, and validates each case against expectations on
agents, tools, phrasing, and latency.

## Prereqs

- API server running (see "Running" below).
- `.env` configured with `OPENAI_API_KEY` (required). `EXA_API_KEY`,
  `KITE_*`, and other credentials are optional — some cases deliberately
  exercise the "tool unavailable" path when those are absent.

## Running

One terminal — start the API:

```bash
bun run api:dev
```

Another terminal — run all eval cases:

```bash
cd apps/api && uv run python scripts/run_evals.py
# or, from the repo root
bun run api:eval
just eval
```

Run a single case:

```bash
cd apps/api && uv run python scripts/run_evals.py --case technical_nvda
# or
just eval-one technical_nvda
```

Useful flags: `--api-url`, `--cases`, `--out-dir`, `--timeout`,
`--fail-fast`.

Reports are written to `tmp/evals/eval-<timestamp>.jsonl` and
`tmp/evals/eval-<timestamp>.md`. `tmp/` is gitignored.

## Adding a case

Append a JSON object on its own line to `cases.jsonl`. Fields:

| field               | type             | notes                                                     |
| ------------------- | ---------------- | --------------------------------------------------------- |
| `id`                | string           | unique; used with `--case`                                |
| `query`             | string           | user message posted to the team                           |
| `ticker`            | string or null   | optional; passed through for memory persistence           |
| `expected_agents`   | list of strings  | agent/team ids that MUST appear in events                 |
| `forbidden_agents`  | list of strings  | agent/team ids that must NOT appear                       |
| `expected_tools`    | list of strings  | tool names that MUST be called                            |
| `forbidden_tools`   | list of strings  | tool names that must NOT be called                        |
| `required_phrases`  | list of strings  | case-insensitive substrings required in output            |
| `forbidden_phrases` | list of strings  | case-insensitive substrings forbidden in output           |
| `max_seconds`       | int              | fail the case if the run takes longer                     |

A `required_phrase` of the form `"A OR B OR C"` passes if any of
`A`, `B`, `C` is present — useful for "either this word or that word"
assertions (see `tool_failure_no_hallucination`).

## How this maps to hackathon judging

- **Evaluation & iteration tooling**: reproducible JSONL cases + a
  single command produce a timestamped Markdown/JSONL report with
  pass/fail reasons — a tight quality loop.
- **Decomposition & handoffs**: `expected_agents` on cases like
  `full_aapl_note` assert the team actually fanned out to multiple
  specialists rather than answering from a single agent.
- **Memory**: `memory_update_aapl` requires `list_prior_runs` to fire
  and the reply to reference prior state — a live check of the memory
  wiring.
- **Tool use & safety**: `kite_missing_confirmation` asserts
  `place_kite_order` is NOT called when confirmation is missing, and
  `tool_failure_no_hallucination` asserts the agent says "unavailable"
  rather than inventing news when a search tool is unusable.
- **Observability**: every case captures the full event-name trace,
  per-agent attribution, and token usage if the stream reports it;
  reports surface it in both JSONL (machine) and Markdown (human).
- **Cost / latency**: each case has a `max_seconds` budget, elapsed is
  recorded per-case, and the Markdown summary totals runtime.

## Limitations

- Live evals require a running API and valid model/tool credentials.
- The model is non-deterministic; individual case passes may vary run
  to run. Re-run and look at the failure reasons rather than chasing
  any single execution.
- Phrase matching is case-insensitive substring — permissive by
  design. Stricter (regex / semantic) matching is a future iteration.
