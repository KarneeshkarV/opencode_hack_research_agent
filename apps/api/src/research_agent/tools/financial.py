import json
from typing import Any

from agno.tools import Toolkit
from agno.tools.calculator import CalculatorTools
from agno.tools.financial_datasets import FinancialDatasetsTools
from agno.tools.yfinance import YFinanceTools

from research_agent.settings import get_settings
from research_agent.tools.technical import get_technical_summary
from research_agent.tools.timeout import call_with_timeout


class TimeoutExaSearchTools(Toolkit):
    def __init__(
        self,
        fixed_max_results: int | None = None,
        text: bool = True,
        text_length_limit: int = 1000,
        **kwargs: Any,
    ) -> None:
        settings = get_settings()
        self.api_key = settings.exa_api_key
        self.fixed_max_results = fixed_max_results
        self.text = text
        self.text_length_limit = text_length_limit

        super().__init__(name="exa_search", tools=[self.web_search, self.search_news], **kwargs)

    def web_search(self, query: str, max_results: int = 5) -> str:
        """Search the web for a query."""
        actual_max_results = self.fixed_max_results or max_results
        return call_with_timeout(
            "web_search",
            get_settings().external_tool_timeout_seconds,
            _exa_search_call,
            query,
            actual_max_results,
            self.api_key,
            None,
            self.text,
            self.text_length_limit,
        )

    def search_news(self, query: str, max_results: int = 5) -> str:
        """Search recent web news for a query."""
        actual_max_results = self.fixed_max_results or max_results
        return call_with_timeout(
            "search_news",
            get_settings().external_tool_timeout_seconds,
            _exa_search_call,
            query,
            actual_max_results,
            self.api_key,
            "news",
            self.text,
            self.text_length_limit,
        )


class TimeoutYFinanceTools(YFinanceTools):
    def get_current_stock_price(self, symbol: str) -> str:
        """Get the current stock price for a public ticker symbol."""
        return self._call_yfinance("get_current_stock_price", symbol)

    def get_company_info(self, symbol: str) -> str:
        """Get company information and overview for a public ticker symbol."""
        return self._call_yfinance("get_company_info", symbol)

    def get_historical_stock_prices(
        self, symbol: str, period: str = "1mo", interval: str = "1d"
    ) -> str:
        """Get historical stock prices for a public ticker symbol."""
        return self._call_yfinance("get_historical_stock_prices", symbol, period, interval)

    def get_stock_fundamentals(self, symbol: str) -> str:
        """Get fundamental data for a public ticker symbol."""
        return self._call_yfinance("get_stock_fundamentals", symbol)

    def get_income_statements(self, symbol: str) -> str:
        """Get income statements for a public ticker symbol."""
        return self._call_yfinance("get_income_statements", symbol)

    def get_key_financial_ratios(self, symbol: str) -> str:
        """Get key financial ratios for a public ticker symbol."""
        return self._call_yfinance("get_key_financial_ratios", symbol)

    def get_analyst_recommendations(self, symbol: str) -> str:
        """Get analyst recommendations for a public ticker symbol."""
        return self._call_yfinance("get_analyst_recommendations", symbol)

    def get_technical_indicators(self, symbol: str, period: str = "3mo") -> str:
        """Get technical indicators for a public ticker symbol."""
        return self._call_yfinance("get_technical_indicators", symbol, period)

    def _call_yfinance(self, method_name: str, *args) -> str:
        return call_with_timeout(
            method_name,
            get_settings().external_tool_timeout_seconds,
            _yfinance_call,
            method_name,
            *args,
        )


def web_tools() -> TimeoutExaSearchTools:
    return TimeoutExaSearchTools(fixed_max_results=6)


def _financial_dataset_tools() -> list[FinancialDatasetsTools]:
    settings = get_settings()
    if not settings.financial_datasets_api_key:
        return []
    return [FinancialDatasetsTools(api_key=settings.financial_datasets_api_key)]


def market_research_tools() -> list:
    return [
        TimeoutYFinanceTools(
            enable_stock_price=True,
            enable_company_info=True,
            enable_analyst_recommendations=True,
            enable_historical_prices=True,
        ),
        web_tools(),
        CalculatorTools(),
        *_financial_dataset_tools(),
    ]


def fundamental_tools() -> list:
    return [
        TimeoutYFinanceTools(
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
        TimeoutYFinanceTools(
            enable_stock_price=True,
            enable_technical_indicators=True,
            enable_historical_prices=True,
        ),
        get_technical_summary,
        CalculatorTools(),
    ]


def risk_tools() -> list:
    return [
        TimeoutYFinanceTools(
            enable_stock_price=True,
            enable_historical_prices=True,
            enable_technical_indicators=True,
            enable_stock_fundamentals=True,
        ),
        get_technical_summary,
        web_tools(),
        CalculatorTools(),
        *_financial_dataset_tools(),
    ]


def macro_tools() -> list:
    return [
        web_tools(),
        TimeoutYFinanceTools(enable_stock_price=True, enable_historical_prices=True),
        CalculatorTools(),
    ]


def term_sheet_tools() -> list:
    return [CalculatorTools(), web_tools()]


def _exa_search_call(
    query: str,
    max_results: int,
    api_key: str | None,
    category: str | None,
    text: bool,
    text_length_limit: int,
) -> str:
    if not api_key:
        return "Error running exa_search: EXA_API_KEY is not configured"

    try:
        from exa_py import Exa
    except ImportError:
        return "Error running exa_search: exa_py is not installed"

    exa = Exa(api_key)
    search_kwargs = {
        "contents": {"text": {"max_characters": text_length_limit}} if text else False,
        "num_results": max_results,
    }
    if category:
        search_kwargs["category"] = category

    exa_results = exa.search(query, **search_kwargs)
    return _parse_exa_results(exa_results, text_length_limit)


def _parse_exa_results(exa_results: Any, text_length_limit: int) -> str:
    parsed_results = []
    for result in getattr(exa_results, "results", []):
        result_dict = {}
        for key in ("url", "title", "author", "published_date", "summary", "text"):
            value = _result_value(result, key)
            if not value:
                continue
            if key == "text" and text_length_limit:
                value = value[:text_length_limit]
            result_dict[key] = value
        parsed_results.append(result_dict)
    return json.dumps(parsed_results, indent=2, ensure_ascii=False)


def _result_value(result: Any, key: str) -> Any:
    if isinstance(result, dict):
        return result.get(key)
    return getattr(result, key, None)


def _yfinance_call(method_name: str, *args) -> str:
    tools = YFinanceTools(all=True)
    return getattr(tools, method_name)(*args)
