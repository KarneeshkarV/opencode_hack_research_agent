from fastapi.testclient import TestClient

from research_agent.agents import build_financial_research_agents, build_financial_research_team
from research_agent.main import app
from research_agent.settings import get_settings
from research_agent.tools import _financial_dataset_tools, market_research_tools, web_tools


def test_health() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_financial_research_team_members() -> None:
    agents = build_financial_research_agents()
    team = build_financial_research_team(agents)

    assert team.id == "financial-research-team"
    assert {agent.id for agent in team.members} == {
        "company-financial-research-agent",
        "macro-economic-agent",
        "term-sheet-agent",
        "technical-analysis-agent",
        "fundamental-analysis-agent",
        "execution-agent",
    }


def test_financial_dataset_tools_are_optional(monkeypatch) -> None:
    monkeypatch.delenv("FINANCIAL_DATASETS_API_KEY", raising=False)
    get_settings.cache_clear()

    assert _financial_dataset_tools() == []

    monkeypatch.setenv("FINANCIAL_DATASETS_API_KEY", "test-key")
    get_settings.cache_clear()

    tools = _financial_dataset_tools()

    assert len(tools) == 1
    assert tools[0].api_key == "test-key"

    get_settings.cache_clear()


def test_web_tools_use_exa_search(monkeypatch) -> None:
    monkeypatch.delenv("EXA_API_KEY", raising=False)
    get_settings.cache_clear()

    tools = web_tools()

    assert tools.name == "exa_search"
    assert set(tools.functions) == {"web_search", "search_news"}

    get_settings.cache_clear()


def test_market_research_tools_do_not_use_yfinance_news() -> None:
    registered_functions = {
        function_name
        for toolkit in market_research_tools()
        for function_name in getattr(toolkit, "functions", {})
    }

    assert "get_company_news" not in registered_functions
    assert "search_news" in registered_functions


def test_financial_research_team_route_is_registered() -> None:
    client = TestClient(app)

    response = client.get("/teams/financial-research-team")

    assert response.status_code == 200
