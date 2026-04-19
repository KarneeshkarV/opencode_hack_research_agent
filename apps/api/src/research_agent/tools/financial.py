from agno.tools.calculator import CalculatorTools
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.financial_datasets import FinancialDatasetsTools
from agno.tools.yfinance import YFinanceTools

from research_agent.settings import get_settings
from research_agent.tools.technical import get_technical_summary
from research_agent.tools.timeout import call_with_timeout


class TimeoutDuckDuckGoTools(DuckDuckGoTools):
    def web_search(self, query: str, max_results: int = 5) -> str:
        """Search the web for a query."""
        actual_max_results = self.fixed_max_results or max_results
        return call_with_timeout(
            "web_search",
            get_settings().external_tool_timeout_seconds,
            _duckduckgo_call,
            "web_search",
            query,
            actual_max_results,
            self.timeout or 10,
            self.region,
            self.backend,
        )

    def search_news(self, query: str, max_results: int = 5) -> str:
        """Search recent web news for a query."""
        actual_max_results = self.fixed_max_results or max_results
        return call_with_timeout(
            "search_news",
            get_settings().external_tool_timeout_seconds,
            _duckduckgo_call,
            "search_news",
            query,
            actual_max_results,
            self.timeout or 10,
            self.region,
            self.backend,
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

    def get_company_news(self, symbol: str, num_stories: int = 3) -> str:
        """Get company news for a public ticker symbol."""
        return self._call_yfinance("get_company_news", symbol, num_stories)

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


def web_tools() -> TimeoutDuckDuckGoTools:
    return TimeoutDuckDuckGoTools(fixed_max_results=6, timeout=10, region="us-en")


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


def macro_tools() -> list:
    return [
        web_tools(),
        TimeoutYFinanceTools(enable_stock_price=True, enable_historical_prices=True),
        CalculatorTools(),
    ]


def term_sheet_tools() -> list:
    return [CalculatorTools(), web_tools()]


def _duckduckgo_call(
    method_name: str,
    query: str,
    max_results: int,
    request_timeout_seconds: int,
    region: str | None,
    backend: str,
) -> str:
    tools = DuckDuckGoTools(
        fixed_max_results=max_results,
        timeout=request_timeout_seconds,
        region=region,
        backend=backend,
    )
    return getattr(tools, method_name)(query=query, max_results=max_results)


def _yfinance_call(method_name: str, *args) -> str:
    tools = YFinanceTools(all=True)
    return getattr(tools, method_name)(*args)
