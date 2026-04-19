import json

from research_agent import memory
from research_agent.settings import get_settings
from research_agent.tools.memory import list_prior_runs, read_prior_run


def _use_tmp_company_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("COMPANY_MEMORY_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield_path = tmp_path
    return yield_path


def test_slugify_ticker_normalizes_punctuation():
    assert memory.slugify_ticker("AAPL") == "AAPL"
    assert memory.slugify_ticker("reliance.ns") == "RELIANCENS"
    assert memory.slugify_ticker("BRK-B") == "BRKB"
    assert memory.slugify_ticker("") == ""


def test_round_trip_write_then_list_then_read(tmp_path, monkeypatch):
    _use_tmp_company_dir(monkeypatch, tmp_path)
    try:
        run_dir = memory.new_run_dir("AAPL")
        memory.write_agent_output(
            run_dir, "company-financial-research-agent", "## Apple\nQualitative read."
        )
        memory.write_agent_output(
            run_dir, "technical-analysis-agent", "## TA\nRSI 62."
        )
        memory.write_synthesis(run_dir, "## Memo\nBuy on dip.")
        memory.write_info_md(
            run_dir,
            {
                "ticker": "AAPL",
                "run_date": run_dir.name,
                "run_id": run_dir.name,
                "query": "give me a full research note on AAPL",
                "model_id": "gpt-5.2",
                "sector": "Technology",
                "industry": "Consumer Electronics",
                "agents_used": ["company-financial-research-agent", "technical-analysis-agent"],
            },
        )

        runs_json = list_prior_runs("aapl")
        runs = json.loads(runs_json)
        assert len(runs) == 1
        assert runs[0]["sector"] == "Technology"
        assert runs[0]["industry"] == "Consumer Electronics"
        assert "Buy on dip" in runs[0]["synthesis_preview"]

        run_id = runs[0]["run_id"]
        loaded_json = read_prior_run("AAPL", run_id, agent_id="technical-analysis-agent")
        loaded = json.loads(loaded_json)
        assert loaded["info"]["sector"] == "Technology"
        assert "Buy on dip" in loaded["synthesis"]
        assert "RSI 62" in loaded["agent_output"]
    finally:
        get_settings.cache_clear()


def test_list_runs_returns_newest_first(tmp_path, monkeypatch):
    _use_tmp_company_dir(monkeypatch, tmp_path)
    try:
        from datetime import UTC, datetime

        old = memory.new_run_dir("MSFT", now=datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC))
        memory.write_synthesis(old, "old memo")
        memory.write_info_md(old, {"run_date": old.name})

        new = memory.new_run_dir("MSFT", now=datetime(2026, 4, 19, 12, 0, 0, tzinfo=UTC))
        memory.write_synthesis(new, "new memo")
        memory.write_info_md(new, {"run_date": new.name})

        runs = json.loads(list_prior_runs("MSFT"))
        assert [r["run_id"] for r in runs] == [new.name, old.name]
    finally:
        get_settings.cache_clear()


def test_list_prior_runs_empty_for_unknown_ticker(tmp_path, monkeypatch):
    _use_tmp_company_dir(monkeypatch, tmp_path)
    try:
        assert json.loads(list_prior_runs("NOPE")) == []
    finally:
        get_settings.cache_clear()
