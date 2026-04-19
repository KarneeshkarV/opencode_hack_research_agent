"""Persistent per-ticker memory layer for the financial research team.

Each completed run for a stock is written under
``<company_memory_dir>/<TICKER>/<UTC-timestamp>/`` with one markdown file per
contributing sub-agent, a ``synthesis.md`` from the team coordinator, and an
``info.md`` meta file. Future runs read from the same folder structure to
build on prior research instead of starting from scratch.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from research_agent.settings import get_settings

RUN_ID_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{6}$")
_TICKER_KEEP_RE = re.compile(r"[^A-Z0-9]")


def company_dir() -> Path:
    return get_settings().company_memory_dir


def slugify_ticker(ticker: str) -> str:
    """Normalize a ticker for use as a folder name.

    Uppercases and strips anything that isn't ``A-Z0-9`` so ``RELIANCE.NS``
    becomes ``RELIANCENS`` and ``BRK-B`` becomes ``BRKB``. Returns ``""`` for
    inputs that contain no usable characters; callers should treat that as
    "ticker unknown" and skip persistence.
    """
    if not ticker:
        return ""
    return _TICKER_KEEP_RE.sub("", ticker.upper())


def _run_id(now: datetime | None = None) -> str:
    moment = now or datetime.now(UTC)
    return moment.strftime("%Y-%m-%d-%H%M%S")


def new_run_dir(ticker: str, now: datetime | None = None) -> Path:
    slug = slugify_ticker(ticker)
    if not slug:
        raise ValueError(f"Cannot create run dir for empty ticker: {ticker!r}")
    path = company_dir() / slug / _run_id(now)
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_agent_output(run_dir: Path, agent_id: str, content: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", agent_id) or "agent"
    target = run_dir / f"{safe}.md"
    target.write_text(content, encoding="utf-8")
    return target


def write_synthesis(run_dir: Path, content: str) -> Path:
    target = run_dir / "synthesis.md"
    target.write_text(content, encoding="utf-8")
    return target


def write_info_md(run_dir: Path, meta: dict[str, Any]) -> Path:
    """Write ``info.md`` with YAML-style frontmatter, no body."""
    lines = ["---"]
    for key, value in meta.items():
        lines.append(f"{key}: {_yaml_scalar(value)}")
    lines.append("---")
    lines.append("")
    target = run_dir / "info.md"
    target.write_text("\n".join(lines), encoding="utf-8")
    return target


def _yaml_scalar(value: Any) -> str:
    if value is None:
        return '""'
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, tuple)):
        if not value:
            return "[]"
        return "[" + ", ".join(_yaml_scalar(v) for v in value) + "]"
    text = str(value).replace("\n", " ").replace('"', '\\"')
    return f'"{text}"'


def _read_info(run_dir: Path) -> dict[str, str]:
    info_path = run_dir / "info.md"
    if not info_path.exists():
        return {}
    text = info_path.read_text(encoding="utf-8")
    meta: dict[str, str] = {}
    in_frontmatter = False
    for line in text.splitlines():
        if line.strip() == "---":
            if in_frontmatter:
                break
            in_frontmatter = True
            continue
        if not in_frontmatter:
            continue
        if ":" not in line:
            continue
        key, _, raw = line.partition(":")
        meta[key.strip()] = raw.strip().strip('"')
    return meta


def list_runs(ticker: str, limit: int = 5) -> list[dict[str, Any]]:
    slug = slugify_ticker(ticker)
    if not slug:
        return []
    ticker_dir = company_dir() / slug
    if not ticker_dir.is_dir():
        return []
    run_dirs = sorted(
        (p for p in ticker_dir.iterdir() if p.is_dir() and RUN_ID_RE.match(p.name)),
        key=lambda p: p.name,
        reverse=True,
    )[:limit]
    out: list[dict[str, Any]] = []
    for run_dir in run_dirs:
        info = _read_info(run_dir)
        synthesis_preview = ""
        synthesis_path = run_dir / "synthesis.md"
        if synthesis_path.exists():
            synthesis_preview = synthesis_path.read_text(encoding="utf-8")[:600]
        out.append(
            {
                "ticker": slug,
                "run_id": run_dir.name,
                "run_date": info.get("run_date", run_dir.name),
                "sector": info.get("sector", ""),
                "industry": info.get("industry", ""),
                "query": info.get("query", ""),
                "agents_used": info.get("agents_used", ""),
                "synthesis_preview": synthesis_preview,
            }
        )
    return out


def read_run(ticker: str, run_id: str, agent_id: str | None = None) -> dict[str, Any]:
    slug = slugify_ticker(ticker)
    if not slug or not RUN_ID_RE.match(run_id):
        return {}
    run_dir = company_dir() / slug / run_id
    if not run_dir.is_dir():
        return {}
    result: dict[str, Any] = {
        "ticker": slug,
        "run_id": run_id,
        "info": _read_info(run_dir),
    }
    synthesis_path = run_dir / "synthesis.md"
    if synthesis_path.exists():
        result["synthesis"] = synthesis_path.read_text(encoding="utf-8")
    if agent_id:
        safe = re.sub(r"[^a-zA-Z0-9._-]", "_", agent_id)
        agent_path = run_dir / f"{safe}.md"
        if agent_path.exists():
            result["agent_output"] = agent_path.read_text(encoding="utf-8")
    return result


def latest_synthesis(ticker: str) -> str | None:
    runs = list_runs(ticker, limit=1)
    if not runs:
        return None
    return runs[0]["synthesis_preview"] or None
