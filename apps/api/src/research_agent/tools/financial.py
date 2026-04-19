from agno.tools.calculator import CalculatorTools
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.financial_datasets import FinancialDatasetsTools
from agno.tools.yfinance import YFinanceTools

from research_agent.settings import get_settings
from research_agent.tools.technical import get_technical_summary


def web_tools() -> DuckDuckGoTools:
    return DuckDuckGoTools(fixed_max_results=6, timeout=20, region="us-en")


def _financial_dataset_tools() -> list[FinancialDatasetsTools]:
    settings = get_settings()
    if not settings.financial_datasets_api_key:
        return []
    return [FinancialDatasetsTools(api_key=settings.financial_datasets_api_key)]


def market_research_tools() -> list:
    return [
        YFinanceTools(
            enable_stock_price=True,
            enable_company_info=True,
            enable_company_news=True,
            enable_analyst_recommendations=True,
            enable_historical_prices=True,
        ),
        web_tools(),
        CalculatorTools(),
        *_financial_dataset_tools(),
    ]


def fundamental_tools() -> list:
    return [
        YFinanceTools(
            enable_stock_price=True,
            enable_company_info=True,
            enable_stock_fundamentals=True,
            enable_income_statements=True,
            enable_key_financial_ratios=True,
            enable_analyst_recommendations=True,
        ),
        web_tools(),
        CalculatorTools(),
        *_financial_dataset_tools(),
    ]


def technical_tools() -> list:
    return [
        YFinanceTools(
            enable_stock_price=True,
            enable_technical_indicators=True,
            enable_historical_prices=True,
        ),
        get_technical_summary,
        CalculatorTools(),
    ]


def macro_tools() -> list:
    return [
        web_tools(),
        YFinanceTools(enable_stock_price=True, enable_historical_prices=True),
        CalculatorTools(),
    ]


def term_sheet_tools() -> list:
    return [CalculatorTools(), web_tools()]
