import json
from typing import Any

from research_agent.settings import get_settings


def place_kite_order(
    tradingsymbol: str,
    transaction_type: str,
    quantity: int,
    product: str,
    order_type: str,
    exchange: str = "NSE",
    variety: str = "regular",
    price: float | None = None,
    trigger_price: float | None = None,
    validity: str = "DAY",
    market_protection: int | None = None,
    disclosed_quantity: int | None = None,
    tag: str | None = None,
    iceberg_legs: int | None = None,
    iceberg_quantity: int | None = None,
    validity_ttl: int | None = None,
    auction_number: str | None = None,
) -> str:
    """Place an order via Zerodha Kite Connect and return a JSON string result.

    When KITE_DRY_RUN is true (default) the call is simulated and no real order
    is submitted. Set KITE_DRY_RUN=false together with valid KITE_API_KEY and
    KITE_ACCESS_TOKEN to place live orders.

    Args:
        tradingsymbol: Instrument symbol, e.g. "INFY", "RELIANCE", "NIFTY24DECFUT".
        transaction_type: BUY or SELL.
        quantity: Number of units to transact (positive integer).
        product: CNC (delivery), NRML (overnight F&O), MIS (intraday), or MTF.
        order_type: MARKET, LIMIT, SL (stop-loss limit), or SL-M (stop-loss market).
        exchange: One of NSE, BSE, NFO, CDS, BCD, MCX. Defaults to "NSE".
        variety: regular, amo (after-market), co (cover), iceberg, or auction.
            Defaults to "regular".
        price: Limit price. Required for LIMIT and SL orders.
        trigger_price: Trigger price. Required for SL and SL-M orders.
        validity: DAY, IOC, or TTL. Defaults to "DAY".
        market_protection: Slippage guard for MARKET orders. 0 disables,
            1-100 sets the allowed % deviation, -1 lets Kite pick.
            Zerodha requires this on API MARKET orders.
        disclosed_quantity: Publicly disclosed quantity for equity orders.
        tag: Free-form alphanumeric tag (max 20 chars) to identify the order.
        iceberg_legs: 2-10 legs, required when variety="iceberg".
        iceberg_quantity: Per-leg quantity, required when variety="iceberg".
        validity_ttl: Minutes the order remains live, required when validity="TTL".
        auction_number: Auction id, required when variety="auction".

    Returns:
        JSON string. On success: {"order_id": "..."} (or {"dry_run": true, ...}).
        On failure: {"error": "..."}.
    """
    settings = get_settings()

    params: dict[str, Any] = {
        "tradingsymbol": tradingsymbol,
        "exchange": exchange,
        "transaction_type": transaction_type,
        "quantity": quantity,
        "product": product,
        "order_type": order_type,
        "variety": variety,
        "validity": validity,
    }
    for key, value in {
        "price": price,
        "trigger_price": trigger_price,
        "market_protection": market_protection,
        "disclosed_quantity": disclosed_quantity,
        "tag": tag,
        "iceberg_legs": iceberg_legs,
        "iceberg_quantity": iceberg_quantity,
        "validity_ttl": validity_ttl,
        "auction_number": auction_number,
    }.items():
        if value is not None:
            params[key] = value

    if settings.kite_dry_run:
        return json.dumps({"dry_run": True, "params": params})

    if not settings.kite_api_key or not settings.kite_access_token:
        return json.dumps(
            {
                "error": "KITE_API_KEY and KITE_ACCESS_TOKEN must be set to place live orders,"
                " or set KITE_DRY_RUN=true to simulate."
            }
        )

    try:
        from kiteconnect import KiteConnect

        kite = KiteConnect(api_key=settings.kite_api_key)
        kite.set_access_token(settings.kite_access_token)
        order_id = kite.place_order(**params)
        return json.dumps({"order_id": order_id, "params": params})
    except Exception as exc:
        return json.dumps({"error": str(exc), "params": params})


def execution_tools() -> list:
    return [place_kite_order]
