"""In-process order capture keyed by conversation session_id.

The FastAPI request handler sets the current session via ``set_session`` before
invoking the team; ``place_kite_order`` calls ``record_order`` after a
successful (or dry-run) execution. ``/sessions/{session_id}/cost`` reads back
the accumulated orders with their computed Indian-market charges.

Storage is per-process memory — adequate for the single-worker dev setup. If
the API ever runs multi-process, swap ``_orders`` for a shared store.
"""

from __future__ import annotations

import contextvars
import threading
from datetime import UTC, datetime
from typing import Any

from research_agent import charges as charges_mod

_current_session_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "research_agent_session_id", default=None
)

_lock = threading.Lock()
_orders: dict[str, list[dict[str, Any]]] = {}


def set_session(session_id: str | None) -> contextvars.Token:
    """Bind ``session_id`` for the current execution context.

    Returns a token; pass it to :func:`reset_session` (or use the returned
    ContextVar token directly) in a ``finally`` block.
    """
    return _current_session_id.set(session_id or None)


def reset_session(token: contextvars.Token) -> None:
    _current_session_id.reset(token)


def current_session() -> str | None:
    return _current_session_id.get()


def record_order(params: dict[str, Any], result: dict[str, Any]) -> None:
    """Capture a successful/dry-run order for the current session.

    No-op when no session is bound (e.g., tool invoked outside the request
    pipeline), so tests and direct CLI invocations remain safe.
    """
    session_id = _current_session_id.get()
    if not session_id:
        return

    price = _resolve_price(params)
    charge = charges_mod.compute_charges(
        transaction_type=params.get("transaction_type", ""),
        quantity=int(params.get("quantity") or 0),
        price=price,
        product=params.get("product", ""),
        exchange=params.get("exchange", "NSE"),
        order_type=params.get("order_type", ""),
        tradingsymbol=params.get("tradingsymbol", ""),
    )

    record = {
        "tradingsymbol": params.get("tradingsymbol"),
        "exchange": params.get("exchange"),
        "transaction_type": params.get("transaction_type"),
        "quantity": params.get("quantity"),
        "product": params.get("product"),
        "order_type": params.get("order_type"),
        "price": price,
        "order_id": result.get("order_id"),
        "dry_run": bool(result.get("dry_run")),
        "charges": charge,
        "recorded_at": datetime.now(UTC).isoformat(),
    }

    with _lock:
        _orders.setdefault(session_id, []).append(record)


def get_orders(session_id: str) -> list[dict[str, Any]]:
    with _lock:
        return list(_orders.get(session_id, []))


def _resolve_price(params: dict[str, Any]) -> float:
    for key in ("price", "trigger_price"):
        val = params.get(key)
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                continue
    return 0.0
