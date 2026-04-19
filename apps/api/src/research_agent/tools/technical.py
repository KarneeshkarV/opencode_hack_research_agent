import json
from typing import Any

import pandas as pd
import yfinance as yf


def get_technical_summary(symbol: str, period: str = "1y") -> str:
    """Return deterministic technical indicators for a public ticker symbol."""
    try:
        ticker = yf.Ticker(symbol)
        prices = ticker.history(period=period, interval="1d", auto_adjust=False)
        if prices.empty:
            return json.dumps({"symbol": symbol, "error": "No price history returned"})

        close = prices["Close"].dropna()
        volume = prices["Volume"].dropna()
        if close.empty:
            return json.dumps({"symbol": symbol, "error": "No close prices returned"})

        latest_close = close.iloc[-1]
        previous_close = close.iloc[-2] if len(close) > 1 else latest_close
        macd_line, macd_signal, macd_histogram = _macd(close)

        summary: dict[str, Any] = {
            "symbol": symbol.upper(),
            "period": period,
            "latest_date": close.index[-1].date().isoformat(),
            "latest_close": _round(latest_close),
            "one_day_change_pct": _round(((latest_close / previous_close) - 1) * 100),
            "sma_20": _round(close.rolling(20).mean().iloc[-1]),
            "sma_50": _round(close.rolling(50).mean().iloc[-1]),
            "sma_200": _round(close.rolling(200).mean().iloc[-1]),
            "rsi_14": _round(_rsi(close, 14).iloc[-1]),
            "macd": _round(macd_line.iloc[-1]),
            "macd_signal": _round(macd_signal.iloc[-1]),
            "macd_histogram": _round(macd_histogram.iloc[-1]),
            "period_high": _round(close.max()),
            "period_low": _round(close.min()),
            "latest_volume": int(volume.iloc[-1]) if not volume.empty else None,
            "avg_volume_20": (
                _round(volume.rolling(20).mean().iloc[-1]) if not volume.empty else None
            ),
        }
        return json.dumps(summary, indent=2)
    except Exception as exc:
        return json.dumps({"symbol": symbol, "error": str(exc)})


def _rsi(close: pd.Series, window: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(window).mean()
    loss = -delta.clip(upper=0).rolling(window).mean()
    relative_strength = gain / loss
    return 100 - (100 / (1 + relative_strength))


def _macd(close: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    fast = close.ewm(span=12, adjust=False).mean()
    slow = close.ewm(span=26, adjust=False).mean()
    macd_line = fast - slow
    signal = macd_line.ewm(span=9, adjust=False).mean()
    return macd_line, signal, macd_line - signal


def _round(value: Any) -> float | None:
    if pd.isna(value):
        return None
    return round(float(value), 4)
