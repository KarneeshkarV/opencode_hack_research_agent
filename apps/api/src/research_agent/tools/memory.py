"""Read-side tools that expose the company memory layer to agents.

Both the team coordinator and every sub-agent can call these to look up what
the team has already concluded about a ticker on prior runs.
"""

from __future__ import annotations

import json

from research_agent import memory


def list_prior_runs(ticker: str, limit: int = 5) -> str:
    """List prior research runs for a ticker, newest first.

    Args:
        ticker: Stock ticker (e.g., "AAPL", "RELIANCE.NS"). Case-insensitive.
        limit: Maximum number of runs to return (default 5).

    Returns:
        JSON array of objects with keys: ``run_id``, ``run_date``, ``sector``,
        ``industry``, ``query``, ``agents_used``, ``synthesis_preview``.
        Empty array if no prior runs exist.
    """
    runs = memory.list_runs(ticker, limit=limit)
    return json.dumps(runs, indent=2, ensure_ascii=False)


def read_prior_run(ticker: str, run_id: str, agent_id: str | None = None) -> str:
    """Load a specific prior run's synthesis (and optionally one sub-agent's output).

    Args:
        ticker: Stock ticker (case-insensitive).
        run_id: Run folder name from ``list_prior_runs`` (e.g., "2026-04-19-143022").
        agent_id: Optional sub-agent id (e.g., "technical-analysis-agent") to load
            that agent's verbatim output in addition to the synthesis.

    Returns:
        JSON object with ``info``, ``synthesis``, and (when ``agent_id`` is set)
        ``agent_output``. Empty object if the run does not exist.
    """
    data = memory.read_run(ticker, run_id, agent_id=agent_id)
    return json.dumps(data, indent=2, ensure_ascii=False)


def memory_tools() -> list:
    return [list_prior_runs, read_prior_run]
