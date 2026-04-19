from agno.agent import Agent
from agno.models.openai import OpenAIResponses
from agno.team import Team, TeamMode
from agno.tools.calculator import CalculatorTools
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.financial_datasets import FinancialDatasetsTools
from agno.tools.yfinance import YFinanceTools

from research_agent.settings import get_settings
from research_agent.tools import get_technical_summary


def _model() -> OpenAIResponses:
    settings = get_settings()
    return OpenAIResponses(id=settings.model_id)


def _web_tools() -> DuckDuckGoTools:
    return DuckDuckGoTools(fixed_max_results=6, timeout=20, region="us-en")


def _financial_dataset_tools() -> list[FinancialDatasetsTools]:
    settings = get_settings()
    if not settings.financial_datasets_api_key:
        return []
    return [FinancialDatasetsTools(api_key=settings.financial_datasets_api_key)]


def _market_research_tools() -> list:
    return [
        YFinanceTools(
            enable_stock_price=True,
            enable_company_info=True,
            enable_company_news=True,
            enable_analyst_recommendations=True,
            enable_historical_prices=True,
        ),
        _web_tools(),
        CalculatorTools(),
        *_financial_dataset_tools(),
    ]


def _fundamental_tools() -> list:
    return [
        YFinanceTools(
            enable_stock_price=True,
            enable_company_info=True,
            enable_stock_fundamentals=True,
            enable_income_statements=True,
            enable_key_financial_ratios=True,
            enable_analyst_recommendations=True,
        ),
        _web_tools(),
        CalculatorTools(),
        *_financial_dataset_tools(),
    ]


def _technical_tools() -> list:
    return [
        YFinanceTools(
            enable_stock_price=True,
            enable_technical_indicators=True,
            enable_historical_prices=True,
        ),
        get_technical_summary,
        CalculatorTools(),
    ]


def build_company_financial_research_agent() -> Agent:
    return Agent(
        id="company-financial-research-agent",
        name="Company Financial Research Agent",
        role="Researches company business quality, news, competitive context, and market facts.",
        model=_model(),
        tools=_market_research_tools(),
        instructions=[
            "Research public companies using ticker symbols when available.",
            "Cover business model, segment exposure, customers, competitors, "
            "management context, and recent catalysts.",
            "Use web/news search for current developments and market context.",
            "Separate sourced facts from analysis, and flag stale or incomplete data.",
        ],
        markdown=True,
        add_datetime_to_context=True,
    )


def build_macro_economic_agent() -> Agent:
    return Agent(
        id="macro-economic-agent",
        name="Macro Economic Agent",
        role="Analyzes macroeconomic backdrop and cross-asset implications.",
        model=_model(),
        tools=[
            _web_tools(),
            YFinanceTools(enable_stock_price=True, enable_historical_prices=True),
            CalculatorTools(),
        ],
        instructions=[
            "Analyze rates, inflation, central bank policy, labor, FX, commodities, "
            "liquidity, and risk regime.",
            "Use market proxies where helpful, such as SPY, QQQ, IWM, TLT, HYG, "
            "GLD, USO, DX-Y.NYB, and major index ETFs.",
            "Connect macro conditions to the company, sector, financing environment, "
            "or term sheet being evaluated.",
            "Call out the date of macro data and avoid treating old releases as current.",
        ],
        markdown=True,
        add_datetime_to_context=True,
    )


def build_term_sheet_agent() -> Agent:
    return Agent(
        id="term-sheet-agent",
        name="Term Sheet Agent",
        role=(
            "Reviews financing terms, investor protections, valuation mechanics, "
            "and founder/company tradeoffs."
        ),
        model=_model(),
        tools=[CalculatorTools(), _web_tools()],
        instructions=[
            "Analyze pasted term sheet text or specific financing terms provided by the user.",
            "Review valuation, option pool treatment, liquidation preference, "
            "participation, anti-dilution, pro rata, governance, information rights, "
            "protective provisions, and closing conditions.",
            "Explain economic impact with simple calculations when numbers are available.",
            "Flag negotiation issues and business risks; do not provide legal advice.",
        ],
        markdown=True,
        add_datetime_to_context=True,
    )


def build_technical_analysis_agent() -> Agent:
    return Agent(
        id="technical-analysis-agent",
        name="Technical Analysis Agent",
        role="Analyzes price action, momentum, trend, support/resistance, and volume.",
        model=_model(),
        tools=_technical_tools(),
        instructions=[
            "Use the technical summary tool for deterministic indicators before "
            "making chart-based claims.",
            "Discuss trend, momentum, volatility, moving averages, RSI, MACD, "
            "volume, support, and resistance.",
            "State the lookback period used and distinguish signal from recommendation.",
            "Avoid overclaiming; technical analysis is probabilistic and should be "
            "paired with fundamentals and macro context.",
        ],
        markdown=True,
        add_datetime_to_context=True,
    )


def build_fundamental_analysis_agent() -> Agent:
    return Agent(
        id="fundamental-analysis-agent",
        name="Fundamental Analysis Agent",
        role=(
            "Analyzes financial statements, margins, cash flow, balance sheet, "
            "valuation, and estimates."
        ),
        model=_model(),
        tools=_fundamental_tools(),
        instructions=[
            "Analyze revenue, margins, EPS, free cash flow, balance sheet strength, "
            "capital intensity, dilution, and valuation multiples.",
            "Prefer FinancialDatasets.ai when available; otherwise use yfinance "
            "and clearly note data limitations.",
            "Compare metrics with the company's own history and relevant peers when available.",
            "Highlight drivers, risks, and what would change the thesis.",
        ],
        markdown=True,
        add_datetime_to_context=True,
    )


def build_financial_research_agents() -> list[Agent]:
    return [
        build_company_financial_research_agent(),
        build_macro_economic_agent(),
        build_term_sheet_agent(),
        build_technical_analysis_agent(),
        build_fundamental_analysis_agent(),
    ]


def build_financial_research_team(members: list[Agent] | None = None) -> Team:
    return Team(
        id="financial-research-team",
        name="Financial Research Team",
        mode=TeamMode.coordinate,
        model=_model(),
        members=members or build_financial_research_agents(),
        instructions=[
            "Coordinate specialists to answer financial research requests for "
            "companies, securities, macro conditions, term sheets, technicals, "
            "and fundamentals.",
            "Delegate to relevant agents, and use multiple specialists when a "
            "request spans company, macro, technical, fundamental, or deal terms.",
            "For public securities, prefer ticker-based data tools and current "
            "web/news search. Use FinancialDatasets.ai data when configured.",
            "Synthesize results into a concise memo with sections for facts, "
            "analysis, risks, and next steps.",
            "Include dates for market and macro data. Do not present investment, "
            "legal, tax, or accounting advice as professional advice.",
        ],
        markdown=True,
        add_datetime_to_context=True,
        share_member_interactions=True,
        show_members_responses=False,
    )


financial_research_agents = build_financial_research_agents()
financial_research_team = build_financial_research_team(financial_research_agents)
