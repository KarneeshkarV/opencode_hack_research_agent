from research_agent.telemetry import instrument_fastapi, setup_telemetry

setup_telemetry()

import json  # noqa: E402
import logging  # noqa: E402
import re  # noqa: E402
from collections.abc import AsyncIterator  # noqa: E402
from typing import Any  # noqa: E402

from agno.os import AgentOS  # noqa: E402
from agno.os.utils import format_sse_event  # noqa: E402
from agno.run.agent import RunCompletedEvent as AgentRunCompletedEvent  # noqa: E402
from agno.run.team import RunCompletedEvent as TeamRunCompletedEvent  # noqa: E402
from fastapi import FastAPI, Form, HTTPException  # noqa: E402
from fastapi.responses import StreamingResponse  # noqa: E402

from research_agent import memory  # noqa: E402
from research_agent.agents import financial_research_agents, financial_research_team  # noqa: E402
from research_agent.settings import get_settings  # noqa: E402
from research_agent.tools.financial import TimeoutYFinanceTools  # noqa: E402

logger = logging.getLogger(__name__)

settings = get_settings()

base_app = FastAPI(title=settings.app_name)


@base_app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


_TICKER_HINT_RE = re.compile(r"\b([A-Z]{2,6}(?:\.[A-Z]{1,4})?)\b")
_STOP_WORDS = {
    "AI", "API", "USD", "EUR", "GBP", "INR", "EPS", "PE", "PEG", "ETF", "IPO",
    "CEO", "CFO", "CTO", "USA", "UK", "EU", "GDP", "FED", "RBI", "SEC", "FX",
    "OK", "ATH", "TLDR", "FAQ",
}


def _resolve_ticker(query: str, explicit: str | None) -> str | None:
    if explicit:
        return explicit.strip() or None
    for token in _TICKER_HINT_RE.findall(query or ""):
        if token in _STOP_WORDS:
            continue
        return token
    return None


def _persist_run(
    *,
    ticker: str,
    query: str,
    team_synthesis: str,
    member_outputs: list[dict[str, Any]],
    sector: str,
    industry: str,
) -> None:
    try:
        run_dir = memory.new_run_dir(ticker)
    except ValueError:
        return

    agents_used: list[str] = []
    for member in member_outputs:
        agent_id = member.get("agent_id") or member.get("team_id") or "unknown-agent"
        content = member.get("content") or ""
        if not content:
            continue
        memory.write_agent_output(run_dir, agent_id, content)
        agents_used.append(agent_id)

    if team_synthesis:
        memory.write_synthesis(run_dir, team_synthesis)

    memory.write_info_md(
        run_dir,
        {
            "ticker": memory.slugify_ticker(ticker),
            "run_date": run_dir.name,
            "run_id": run_dir.name,
            "query": query,
            "model_id": settings.model_id,
            "sector": sector,
            "industry": industry,
            "agents_used": agents_used,
        },
    )
    logger.info("Persisted research run for %s at %s", ticker, run_dir)


def _extract_sector_industry(
    member_outputs: list[dict[str, Any]], ticker: str | None = None
) -> tuple[str, str]:
    """Resolve sector/industry for memory metadata.

    Prefer deterministic company-info data so memory metadata does not depend on
    whether a specialist included exact `Sector:` / `Industry:` lines in markdown.
    Agent markdown remains a fallback for any missing field.
    """
    fetched_sector, fetched_industry = _fetch_sector_industry(ticker) if ticker else ("", "")
    agent_sector, agent_industry = "", ""
    for member in member_outputs:
        if member.get("agent_id") != "company-financial-research-agent":
            continue
        text = member.get("content") or ""
        agent_sector = _grep_field(text, "sector")
        agent_industry = _grep_field(text, "industry")
        break
    return fetched_sector or agent_sector, fetched_industry or agent_industry


def _grep_field(text: str, label: str) -> str:
    match = re.search(rf"(?im)^[*\s\-]*{label}[*\s]*:\s*([^\n]+)$", text)
    if not match:
        return ""
    return re.sub(r"[*_`]", "", match.group(1)).strip()


def _fetch_sector_industry(ticker: str) -> tuple[str, str]:
    """Fallback to deterministic company-info data when agent markdown omits metadata."""
    try:
        raw = TimeoutYFinanceTools(enable_company_info=True).get_company_info(ticker)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not fetch sector/industry for %s: %s", ticker, exc)
        return "", ""
    return _parse_sector_industry(raw)


def _parse_sector_industry(text: str) -> tuple[str, str]:
    if not text:
        return "", ""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = None
    if isinstance(data, dict):
        sector = _clean_meta_value(data.get("Sector") or data.get("sector"))
        industry = _clean_meta_value(data.get("Industry") or data.get("industry"))
        if sector or industry:
            return sector, industry
    return _grep_field(text, "sector"), _grep_field(text, "industry")


def _clean_meta_value(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text or text.upper() == "N/A":
        return ""
    return text


async def _run_and_capture(
    message: str,
    ticker: str | None,
    session_id: str | None,
) -> AsyncIterator[str]:
    """Stream SSE events for a team run AND persist the final outputs to disk."""

    member_outputs: list[dict[str, Any]] = []
    team_synthesis = ""

    try:
        stream = financial_research_team.arun(
            input=message,
            session_id=session_id,
            stream=True,
            stream_events=True,
        )
        async for event in stream:
            yield format_sse_event(event)

            if isinstance(event, AgentRunCompletedEvent):
                member_outputs.append(
                    {
                        "agent_id": getattr(event, "agent_id", None),
                        "agent_name": getattr(event, "agent_name", None),
                        "content": _coerce_text(getattr(event, "content", "")),
                    }
                )
            elif isinstance(event, TeamRunCompletedEvent):
                team_synthesis = _coerce_text(getattr(event, "content", ""))
                for resp in getattr(event, "member_responses", []) or []:
                    member_outputs.append(
                        {
                            "agent_id": getattr(resp, "agent_id", None)
                            or getattr(resp, "team_id", None),
                            "agent_name": getattr(resp, "agent_name", None)
                            or getattr(resp, "team_name", None),
                            "content": _coerce_text(getattr(resp, "content", "")),
                        }
                    )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Team run failed: %s", exc)
        raise

    member_outputs = _dedupe_members(member_outputs)
    resolved = _resolve_ticker(message, ticker)
    if not resolved:
        logger.info("No ticker resolved for query %r — skipping persistence", message)
        return

    sector, industry = _extract_sector_industry(member_outputs, resolved)
    _persist_run(
        ticker=resolved,
        query=message,
        team_synthesis=team_synthesis,
        member_outputs=member_outputs,
        sector=sector,
        industry=industry,
    )


def _coerce_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    return str(content)


def _dedupe_members(members: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep the longest content per agent_id (later RunCompleted events tend to be richest)."""
    by_id: dict[str, dict[str, Any]] = {}
    for member in members:
        agent_id = member.get("agent_id")
        if not agent_id:
            continue
        existing = by_id.get(agent_id)
        if existing is None or len(member["content"]) > len(existing["content"]):
            by_id[agent_id] = member
    return list(by_id.values())


@base_app.post(f"/teams/{financial_research_team.id}/runs")
async def create_team_run(
    message: str = Form(...),
    stream: bool = Form(default=True),
    stream_events: bool = Form(default=True),
    stream_member_events: bool = Form(default=True),
    session_id: str | None = Form(default=None),
    ticker: str | None = Form(default=None),
) -> StreamingResponse:
    """Drop-in replacement for AgentOS's team-run route that also persists each
    completed run to the company memory layer (one folder per ticker, one
    subfolder per dated run, per-agent markdown + synthesis + info.md).

    Registered on ``base_app`` before AgentOS attaches its own routes; AgentOS is
    configured with ``on_route_conflict="preserve_base_app"`` so this handler wins.
    Streaming/SSE format mirrors AgentOS's so the existing CLI parses it unchanged.
    """
    if not message.strip():
        raise HTTPException(status_code=400, detail="message is required")
    if not stream:
        raise HTTPException(
            status_code=400,
            detail="non-streaming runs are not supported by the persistence wrapper",
        )
    # `stream_events` / `stream_member_events` are accepted for API parity; the
    # underlying team.arun stream already includes both.
    del stream_events, stream_member_events
    return StreamingResponse(
        _run_and_capture(message, ticker, session_id),
        media_type="text/event-stream",
    )


agent_os = AgentOS(
    name=settings.app_name,
    agents=financial_research_agents,
    teams=[financial_research_team],
    base_app=base_app,
    on_route_conflict="preserve_base_app",
    tracing=False,
)

app = agent_os.get_app()
instrument_fastapi(app)


def main() -> None:
    agent_os.serve(app="research_agent.main:app", reload=True)


if __name__ == "__main__":
    main()
