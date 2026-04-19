"""Zerodha-style Indian equity/F&O charge breakdown.

Rates are simplified to the canonical published Zerodha charges and are the
same numbers shown in Zerodha's brokerage calculator. They are intentionally
approximate — exchange transaction charges and stamp duty shift from time to
time, and GST/slab changes are not modelled. The breakdown is sufficient to
give the CLI a realistic INR total per order.
"""

from __future__ import annotations

from typing import Any


def _segment(exchange: str, tradingsymbol: str) -> str:
    """Classify the instrument into one of: equity, fut, opt."""
    ex = (exchange or "").upper()
    sym = (tradingsymbol or "").upper()
    if ex in {"NFO", "BFO", "CDS", "BCD", "MCX"}:
        if sym.endswith("CE") or sym.endswith("PE"):
            return "opt"
        return "fut"
    return "equity"


def compute_charges(
    *,
    transaction_type: str,
    quantity: int,
    price: float,
    product: str,
    exchange: str,
    order_type: str,
    tradingsymbol: str = "",
) -> dict[str, Any]:
    """Return a Zerodha-style charge breakdown in INR for a single order."""
    side = (transaction_type or "").upper()  # BUY / SELL
    prod = (product or "").upper()
    ex = (exchange or "").upper()
    seg = _segment(ex, tradingsymbol)

    qty = max(int(quantity or 0), 0)
    px = max(float(price or 0.0), 0.0)
    turnover = qty * px

    if seg == "equity":
        if prod == "CNC":
            brokerage = 0.0
        else:  # MIS / NRML / MTF intraday-style
            brokerage = min(20.0, 0.0003 * turnover)
    elif seg == "fut":
        brokerage = min(20.0, 0.0003 * turnover)
    else:  # opt
        brokerage = 20.0 if turnover > 0 else 0.0

    stt = 0.0
    if seg == "equity":
        if prod == "CNC":
            stt = 0.001 * turnover
        elif side == "SELL":
            stt = 0.00025 * turnover
    elif seg == "fut":
        if side == "SELL":
            stt = 0.0002 * turnover
    else:  # opt, STT on sell premium
        if side == "SELL":
            stt = 0.001 * turnover

    if seg == "equity":
        exchange_txn = (0.00297 if ex == "NSE" else 0.00375) / 100 * turnover
    elif seg == "fut":
        exchange_txn = 0.0019 / 100 * turnover
    else:
        exchange_txn = 0.05 / 100 * turnover

    sebi = 0.000001 * turnover  # 10 / crore

    stamp_duty = 0.0
    if side == "BUY":
        if seg == "equity":
            stamp_duty = (0.00015 if prod == "CNC" else 0.00003) * turnover
        elif seg == "fut":
            stamp_duty = 0.00002 * turnover
        else:
            stamp_duty = 0.00003 * turnover

    gst = 0.18 * (brokerage + exchange_txn + sebi)

    total = brokerage + stt + exchange_txn + sebi + gst + stamp_duty

    def _r(x: float) -> float:
        return round(x, 4)

    return {
        "turnover": _r(turnover),
        "brokerage": _r(brokerage),
        "stt": _r(stt),
        "exchange_txn": _r(exchange_txn),
        "sebi": _r(sebi),
        "gst": _r(gst),
        "stamp_duty": _r(stamp_duty),
        "total": _r(total),
        "segment": seg,
    }
