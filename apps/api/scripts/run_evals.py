"""Black-box eval runner for the financial-research-team HTTP endpoint.

Drives the real streaming path at POST /teams/financial-research-team/runs,
parses the SSE stream, and validates each case against expectations on
agents, tools, phrasing, and latency. Writes a JSONL + Markdown report to
tmp/evals/.

Pure helpers (parse_sse_stream, extract_*, validate_case) live at the top
of the file so tests can exercise them without a running API server.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

TEAM_ID = "financial-research-team"
TEAM_RUN_PATH = f"/teams/{TEAM_ID}/runs"
FINAL_EVENT_NAMES = {"RunCompleted", "TeamRunCompleted", "completed"}
CONTENT_EVENT_NAMES = {"RunContent", "TeamRunContent", "RunResponseContent", "content"}


# ---------------------------------------------------------------------------
# Pure helpers — unit-testable without network or the API server.
# ---------------------------------------------------------------------------


@dataclass
class ParsedEvent:
    event: str
    data: dict[str, Any]
    raw: str


def parse_sse_stream(chunks: Iterable[str | bytes]) -> Iterator[ParsedEvent]:
    """Parse an SSE byte/text stream chunk-by-chunk.

    Accepts an iterable of strings or bytes (each chunk may contain any
    number of events, or a partial event that will complete on a later
    chunk). Yields ParsedEvent objects as complete blocks arrive.

    A block is terminated by a blank line (``\\n\\n``). Within a block,
    ``event:`` sets the event name and ``data:`` lines are concatenated
    (joined by newlines, per SSE spec) and JSON-decoded. Comment lines
    (starting with ``:``) and unknown fields are skipped. Blocks whose
    data fails to JSON-decode are yielded with ``data = {}`` so callers
    can still see the raw bytes.
    """
    buffer = ""
    for chunk in chunks:
        if isinstance(chunk, bytes):
            chunk = chunk.decode("utf-8", errors="replace")
        buffer += chunk
        while True:
            sep_idx = _find_blank_line(buffer)
            if sep_idx == -1:
                break
            block, buffer = buffer[:sep_idx], buffer[_skip_blank_line(buffer, sep_idx) :]
            parsed = _parse_block(block)
            if parsed is not None:
                yield parsed
    # Flush any trailing block that did not end with a blank line.
    tail = buffer.strip()
    if tail:
        parsed = _parse_block(tail)
        if parsed is not None:
            yield parsed


def _find_blank_line(s: str) -> int:
    """Return the index of the first blank-line separator, or -1."""
    for token in ("\r\n\r\n", "\n\n", "\r\r"):
        idx = s.find(token)
        if idx != -1:
            return idx
    return -1


def _skip_blank_line(s: str, idx: int) -> int:
    for token in ("\r\n\r\n", "\n\n", "\r\r"):
        if s.startswith(token, idx):
            return idx + len(token)
    return idx


def _parse_block(block: str) -> ParsedEvent | None:
    event_name = "message"
    data_lines: list[str] = []
    for raw_line in block.splitlines():
        line = raw_line.rstrip("\r")
        if not line or line.startswith(":"):
            continue
        if ":" in line:
            field_name, _, value = line.partition(":")
            if value.startswith(" "):
                value = value[1:]
        else:
            field_name, value = line, ""
        if field_name == "event":
            event_name = value or event_name
        elif field_name == "data":
            data_lines.append(value)
    if not data_lines and event_name == "message":
        return None
    data_str = "\n".join(data_lines)
    try:
        data = json.loads(data_str) if data_str else {}
    except json.JSONDecodeError:
        data = {}
    if not isinstance(data, dict):
        data = {"_value": data}
    return ParsedEvent(event=event_name, data=data, raw=block)


def extract_event_name(parsed: ParsedEvent) -> str:
    if parsed.event and parsed.event != "message":
        return parsed.event
    inner = parsed.data.get("event")
    if isinstance(inner, str) and inner:
        return inner
    return parsed.event or "message"


def extract_agents(parsed: ParsedEvent) -> list[str]:
    """Return all agent/team identifiers mentioned in the event.

    Agents and teams are both recorded — the team id is how we know the
    orchestrator itself ran, and agent ids are how we know which members
    participated. Duplicates are preserved in occurrence order.
    """
    found: list[str] = []
    for key in ("agent_id", "agent_name", "team_id", "team_name"):
        value = parsed.data.get(key)
        if isinstance(value, str) and value and value not in found:
            found.append(value)
    # Some events nest member info under "member" / "member_responses".
    member = parsed.data.get("member")
    if isinstance(member, dict):
        for key in ("agent_id", "agent_name", "team_id", "team_name"):
            value = member.get(key)
            if isinstance(value, str) and value and value not in found:
                found.append(value)
    return found


def extract_tool(parsed: ParsedEvent) -> str | None:
    """Best-effort tool name extraction across several shapes Agno emits."""
    data = parsed.data
    tool = data.get("tool")
    if isinstance(tool, dict):
        name = tool.get("tool_name")
        if isinstance(name, str) and name:
            return name
        function = tool.get("function")
        if isinstance(function, dict):
            name = function.get("name")
            if isinstance(name, str) and name:
                return name
        name = tool.get("name")
        if isinstance(name, str) and name:
            return name
    name = data.get("tool_name")
    if isinstance(name, str) and name:
        return name
    function = data.get("function")
    if isinstance(function, dict):
        name = function.get("name")
        if isinstance(name, str) and name:
            return name
    return None


def _event_content(parsed: ParsedEvent) -> str | None:
    content = parsed.data.get("content")
    if isinstance(content, str) and content:
        return content
    # Some events wrap content in {"content": {"text": ...}} or similar.
    if isinstance(content, dict):
        for key in ("text", "output", "value"):
            inner = content.get(key)
            if isinstance(inner, str) and inner:
                return inner
    return None


def extract_final_output(events: list[ParsedEvent]) -> str:
    """Pick the best final-output string from the captured events.

    Preference order:
      1. Latest RunCompleted/TeamRunCompleted event with content that
         references the financial-research-team id.
      2. Latest RunCompleted-ish event with string content.
      3. Concatenation of all streamed content deltas.
    """
    for parsed in reversed(events):
        if extract_event_name(parsed) in FINAL_EVENT_NAMES:
            if TEAM_ID in extract_agents(parsed):
                content = _event_content(parsed)
                if content:
                    return content
    for parsed in reversed(events):
        if extract_event_name(parsed) in FINAL_EVENT_NAMES:
            content = _event_content(parsed)
            if content:
                return content
    deltas: list[str] = []
    for parsed in events:
        if extract_event_name(parsed) in CONTENT_EVENT_NAMES:
            content = _event_content(parsed)
            if content:
                deltas.append(content)
    return "".join(deltas)


def _phrase_present(phrase: str, haystack: str) -> bool:
    hay = haystack.lower()
    # Disjunction: "A OR B OR C" passes if any disjunct is present.
    if " OR " in phrase:
        return any(part.strip().lower() in hay for part in phrase.split(" OR ") if part.strip())
    return phrase.lower() in hay


def validate_case(case: dict[str, Any], collected: dict[str, Any]) -> tuple[bool, list[str]]:
    """Return (passed, failure_reasons). Reasons are empty iff passed."""
    failures: list[str] = []

    output = collected.get("output") or ""
    if not output.strip():
        failures.append("final output was empty")

    error = collected.get("error")
    if error:
        failures.append(f"request error: {error}")

    max_seconds = case.get("max_seconds")
    elapsed = collected.get("elapsed", 0.0)
    if isinstance(max_seconds, (int, float)) and elapsed > max_seconds:
        failures.append(f"elapsed {elapsed:.1f}s exceeded max_seconds {max_seconds}")

    haystack = (output or "") + "\n" + (collected.get("streamed_text") or "")
    for phrase in case.get("required_phrases", []) or []:
        if not _phrase_present(phrase, haystack):
            failures.append(f"missing required phrase: {phrase}")
    for phrase in case.get("forbidden_phrases", []) or []:
        if _phrase_present(phrase, haystack):
            failures.append(f"forbidden phrase present: {phrase}")

    observed_agents = set(collected.get("agents") or [])
    for agent in case.get("expected_agents", []) or []:
        if agent not in observed_agents:
            failures.append(f"expected agent not observed: {agent}")
    for agent in case.get("forbidden_agents", []) or []:
        if agent in observed_agents:
            failures.append(f"forbidden agent observed: {agent}")

    observed_tools = set(collected.get("tools") or [])
    for tool in case.get("expected_tools", []) or []:
        if tool not in observed_tools:
            failures.append(f"expected tool not observed: {tool}")
    for tool in case.get("forbidden_tools", []) or []:
        if tool in observed_tools:
            failures.append(f"forbidden tool observed: {tool}")

    return (len(failures) == 0, failures)


# ---------------------------------------------------------------------------
# Live runner — requires httpx and a running API server.
# ---------------------------------------------------------------------------


@dataclass
class CaseResult:
    case_id: str
    passed: bool
    failures: list[str]
    elapsed: float
    session_id: str
    output: str
    agents: list[str]
    tools: list[str]
    event_names: list[str]
    error: str | None = None
    http_status: int | None = None
    token_usage: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "case_id": self.case_id,
            "passed": self.passed,
            "failures": self.failures,
            "elapsed": round(self.elapsed, 2),
            "session_id": self.session_id,
            "output": self.output,
            "agents": self.agents,
            "tools": self.tools,
            "event_names": self.event_names,
            "error": self.error,
            "http_status": self.http_status,
            "token_usage": self.token_usage,
        }


def load_cases(path: Path) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        try:
            cases.append(json.loads(stripped))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{path}:{line_no}: invalid JSON ({exc})") from exc
    return cases


def run_case(case: dict[str, Any], api_url: str, timeout: float) -> CaseResult:
    import httpx

    case_id = case["id"]
    session_id = f"eval-{case_id}-{int(time.time())}"
    form: dict[str, str] = {
        "message": case["query"],
        "stream": "true",
        "stream_events": "true",
        "stream_member_events": "true",
        "session_id": session_id,
    }
    ticker = case.get("ticker")
    if ticker:
        form["ticker"] = ticker

    url = api_url.rstrip("/") + TEAM_RUN_PATH
    events: list[ParsedEvent] = []
    event_names: list[str] = []
    agents_seen: list[str] = []
    tools_seen: list[str] = []
    streamed_text_parts: list[str] = []
    token_usage: dict[str, Any] = {}
    error: str | None = None
    http_status: int | None = None

    start = time.monotonic()
    try:
        with httpx.Client(timeout=timeout) as client:
            with client.stream(
                "POST",
                url,
                data=form,
                headers={"Accept": "text/event-stream"},
            ) as response:
                http_status = response.status_code
                if response.status_code >= 400:
                    body = response.read().decode("utf-8", errors="replace")
                    error = f"HTTP {response.status_code}: {body[:500]}"
                else:
                    for parsed in parse_sse_stream(response.iter_bytes()):
                        events.append(parsed)
                        name = extract_event_name(parsed)
                        event_names.append(name)
                        for agent in extract_agents(parsed):
                            if agent not in agents_seen:
                                agents_seen.append(agent)
                        tool = extract_tool(parsed)
                        if tool and tool not in tools_seen:
                            tools_seen.append(tool)
                        if name in CONTENT_EVENT_NAMES:
                            content = _event_content(parsed)
                            if content:
                                streamed_text_parts.append(content)
                        usage = parsed.data.get("metrics") or parsed.data.get("usage")
                        if isinstance(usage, dict):
                            for key, value in usage.items():
                                if isinstance(value, (int, float)):
                                    token_usage[key] = token_usage.get(key, 0) + value
    except Exception as exc:  # noqa: BLE001 — surface any runtime error verbatim
        error = f"{type(exc).__name__}: {exc}"
    elapsed = time.monotonic() - start

    output = extract_final_output(events)
    collected = {
        "output": output,
        "agents": agents_seen,
        "tools": tools_seen,
        "events": events,
        "elapsed": elapsed,
        "error": error,
        "streamed_text": "".join(streamed_text_parts),
    }
    passed, failures = validate_case(case, collected)
    return CaseResult(
        case_id=case["id"],
        passed=passed,
        failures=failures,
        elapsed=elapsed,
        session_id=session_id,
        output=output,
        agents=agents_seen,
        tools=tools_seen,
        event_names=event_names,
        error=error,
        http_status=http_status,
        token_usage=token_usage,
    )


def write_reports(results: list[CaseResult], out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    jsonl_path = out_dir / f"eval-{stamp}.jsonl"
    md_path = out_dir / f"eval-{stamp}.md"

    with jsonl_path.open("w", encoding="utf-8") as fh:
        for result in results:
            fh.write(json.dumps(result.to_dict(), ensure_ascii=False) + "\n")

    passed = sum(1 for r in results if r.passed)
    total = len(results)
    lines: list[str] = []
    lines.append(f"# Eval report — {stamp}")
    lines.append("")
    total_elapsed = sum(r.elapsed for r in results)
    lines.append(f"**{passed}/{total} passed**  •  total elapsed: {total_elapsed:.1f}s")
    lines.append("")
    lines.append("| Case | Pass | Elapsed | Agents | Tools |")
    lines.append("|---|---|---|---|---|")
    for r in results:
        agents = ", ".join(r.agents) or "—"
        tools = ", ".join(r.tools) or "—"
        status = "PASS" if r.passed else "FAIL"
        lines.append(f"| {r.case_id} | {status} | {r.elapsed:.1f}s | {agents} | {tools} |")
    lines.append("")
    failed = [r for r in results if not r.passed]
    if failed:
        lines.append("## Failures")
        lines.append("")
        for r in failed:
            lines.append(f"### {r.case_id}")
            for reason in r.failures:
                lines.append(f"- {reason}")
            lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return jsonl_path, md_path


def print_summary(results: list[CaseResult]) -> None:
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        print(f"{status}  {r.case_id:32s}  {r.elapsed:6.1f}s")
        if not r.passed:
            for reason in r.failures:
                print(f"        - {reason}")
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    total_elapsed = sum(r.elapsed for r in results)
    print(f"\n{passed}/{total} passed in {total_elapsed:.1f}s")


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    default_cases = (here.parent / "evals" / "cases.jsonl").resolve()
    default_out = (here.parent.parent.parent / "tmp" / "evals").resolve()

    parser = argparse.ArgumentParser(description="Run the research-agent eval harness.")
    parser.add_argument("--api-url", default="http://localhost:7777")
    parser.add_argument("--cases", type=Path, default=default_cases)
    parser.add_argument("--case", default=None, help="Run only this case id.")
    parser.add_argument("--out-dir", type=Path, default=default_out)
    parser.add_argument("--timeout", type=float, default=360.0)
    parser.add_argument("--fail-fast", action="store_true")
    args = parser.parse_args(argv)

    cases = load_cases(args.cases)
    if args.case:
        cases = [c for c in cases if c.get("id") == args.case]
        if not cases:
            print(f"no case found with id={args.case!r} in {args.cases}", file=sys.stderr)
            return 1

    results: list[CaseResult] = []
    for case in cases:
        print(f"→ {case['id']}")
        result = run_case(case, args.api_url, args.timeout)
        results.append(result)
        if args.fail_fast and not result.passed:
            break

    jsonl_path, md_path = write_reports(results, args.out_dir)
    print(f"\nreports: {jsonl_path}\n         {md_path}\n")
    print_summary(results)
    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
