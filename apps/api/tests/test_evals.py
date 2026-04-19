"""Unit tests for the pure helpers in scripts/run_evals.py.

These tests do not require the API server, OpenAI, Exa, Kite, or network.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import run_evals  # noqa: E402  (path is inserted above)
from run_evals import (  # noqa: E402
    ParsedEvent,
    extract_agents,
    extract_event_name,
    extract_final_output,
    extract_tool,
    parse_sse_stream,
    validate_case,
)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def test_parse_sse_single_event() -> None:
    stream = [_sse("RunStarted", {"run_id": "r1", "team_id": "financial-research-team"})]
    events = list(parse_sse_stream(stream))
    assert len(events) == 1
    assert events[0].event == "RunStarted"
    assert events[0].data["run_id"] == "r1"


def test_parse_sse_multi_event() -> None:
    stream = [
        _sse("RunStarted", {"run_id": "r1"})
        + _sse("RunCompleted", {"run_id": "r1", "content": "hello"})
    ]
    events = list(parse_sse_stream(stream))
    assert [e.event for e in events] == ["RunStarted", "RunCompleted"]
    assert events[1].data["content"] == "hello"


def test_parse_sse_chunked() -> None:
    full = _sse("RunCompleted", {"content": "done"})
    split = len(full) // 2
    events = list(parse_sse_stream([full[:split], full[split:]]))
    assert len(events) == 1
    assert events[0].event == "RunCompleted"
    assert events[0].data["content"] == "done"


def test_parse_sse_ignores_comment_and_blank() -> None:
    stream = [": keepalive\n\n" + _sse("RunContent", {"content": "tick"})]
    events = list(parse_sse_stream(stream))
    assert [e.event for e in events] == ["RunContent"]


def test_extract_tool_variants() -> None:
    shapes = [
        {"tool": {"tool_name": "place_kite_order"}},
        {"tool": {"function": {"name": "place_kite_order"}}},
        {"tool": {"name": "place_kite_order"}},
        {"tool_name": "place_kite_order"},
        {"function": {"name": "place_kite_order"}},
    ]
    for data in shapes:
        parsed = ParsedEvent(event="ToolCallStarted", data=data, raw="")
        assert extract_tool(parsed) == "place_kite_order", data


def test_extract_agent_prefers_agent_id_then_team_id() -> None:
    agent_evt = ParsedEvent(
        event="RunCompleted",
        data={"agent_id": "technical-analysis-agent", "team_id": "financial-research-team"},
        raw="",
    )
    agents = extract_agents(agent_evt)
    assert agents[0] == "technical-analysis-agent"
    assert "financial-research-team" in agents

    team_only = ParsedEvent(
        event="RunStarted", data={"team_id": "financial-research-team"}, raw=""
    )
    assert extract_agents(team_only) == ["financial-research-team"]


def test_extract_final_output_prefers_run_completed() -> None:
    events = [
        ParsedEvent(event="RunContent", data={"content": "partial 1"}, raw=""),
        ParsedEvent(event="RunContent", data={"content": "partial 2"}, raw=""),
        ParsedEvent(
            event="RunCompleted",
            data={"content": "FINAL", "team_id": "financial-research-team"},
            raw="",
        ),
    ]
    assert extract_final_output(events) == "FINAL"
    assert extract_event_name(events[2]) == "RunCompleted"


def test_extract_final_output_falls_back_to_deltas() -> None:
    events = [
        ParsedEvent(event="RunContent", data={"content": "one "}, raw=""),
        ParsedEvent(event="RunContent", data={"content": "two"}, raw=""),
    ]
    assert extract_final_output(events) == "one two"


def test_validate_case_passes_when_all_constraints_met() -> None:
    case = {
        "id": "t",
        "required_phrases": ["RSI", "MACD"],
        "forbidden_phrases": [],
        "expected_agents": ["technical-analysis-agent"],
        "forbidden_agents": ["execution-agent"],
        "expected_tools": [],
        "forbidden_tools": [],
        "max_seconds": 60,
    }
    collected = {
        "output": "RSI looks strong and MACD is crossing up.",
        "streamed_text": "",
        "agents": ["financial-research-team", "technical-analysis-agent"],
        "tools": [],
        "elapsed": 5.0,
        "error": None,
    }
    passed, failures = validate_case(case, collected)
    assert passed, failures
    assert failures == []


def test_validate_case_flags_missing_phrase_and_forbidden_tool() -> None:
    case = {
        "id": "t",
        "required_phrases": ["RSI"],
        "forbidden_phrases": [],
        "expected_agents": [],
        "forbidden_agents": [],
        "expected_tools": [],
        "forbidden_tools": ["place_kite_order"],
        "max_seconds": 60,
    }
    collected = {
        "output": "no indicators here",
        "streamed_text": "",
        "agents": [],
        "tools": ["place_kite_order"],
        "elapsed": 1.0,
        "error": None,
    }
    passed, failures = validate_case(case, collected)
    assert not passed
    assert any("required phrase" in f for f in failures)
    assert any("forbidden tool" in f for f in failures)


def test_validate_case_disjunctive_required_phrase() -> None:
    case = {
        "id": "t",
        "required_phrases": ["unavailable OR error OR failed OR stale"],
        "forbidden_phrases": ["I found"],
        "expected_agents": [],
        "forbidden_agents": [],
        "expected_tools": [],
        "forbidden_tools": [],
        "max_seconds": 60,
    }
    # Passes because "unavailable" is in the haystack.
    good = {
        "output": "news is unavailable right now",
        "streamed_text": "",
        "agents": [],
        "tools": [],
        "elapsed": 1.0,
        "error": None,
    }
    passed, failures = validate_case(case, good)
    assert passed, failures

    # Fails: none of the disjuncts, and forbidden phrase present.
    bad = {
        "output": "I found three articles...",
        "streamed_text": "",
        "agents": [],
        "tools": [],
        "elapsed": 1.0,
        "error": None,
    }
    passed, failures = validate_case(case, bad)
    assert not passed
    assert any("required phrase" in f for f in failures)
    assert any("forbidden phrase" in f for f in failures)


def test_validate_case_flags_timeout_and_error() -> None:
    case = {"id": "t", "max_seconds": 1}
    collected = {
        "output": "something",
        "streamed_text": "",
        "agents": [],
        "tools": [],
        "elapsed": 5.0,
        "error": "ConnectError: server down",
    }
    passed, failures = validate_case(case, collected)
    assert not passed
    assert any("elapsed" in f for f in failures)
    assert any("request error" in f for f in failures)


def test_run_evals_module_does_not_require_httpx_at_import() -> None:
    # Guards that `import run_evals` stays usable in environments where
    # httpx is absent (tests would otherwise fail at collection time).
    assert run_evals.TEAM_ID == "financial-research-team"
    assert run_evals.TEAM_RUN_PATH.endswith("/runs")
