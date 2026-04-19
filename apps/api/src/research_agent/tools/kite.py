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


def _kite_client():
    """Return (client, error_message). client is None when error_message is set."""
    settings = get_settings()
    if not settings.kite_api_key or not settings.kite_access_token:
        return None, "`KITE_API_KEY` and `KITE_ACCESS_TOKEN` must be set."
    try:
        from kiteconnect import KiteConnect

        kite = KiteConnect(api_key=settings.kite_api_key)
        kite.set_access_token(settings.kite_access_token)
        return kite, None
    except Exception as exc:
        return None, str(exc)


def _fmt_num(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, (int, float)):
        return f"{value:,.2f}" if isinstance(value, float) else f"{value:,}"
    return str(value)


def get_kite_profile() -> str:
    """Fetch the authenticated Kite user's profile and return it as Markdown.

    Use this to personalize responses, address the user by name, and confirm
    which exchanges, products, and order types the account is permitted to
    trade before suggesting or placing orders.

    Returns:
        Markdown string describing the profile, or a Markdown error block if
        credentials are missing or the API call fails.
    """
    settings = get_settings()

    if not settings.kite_api_key or not settings.kite_access_token:
        return (
            "**Kite profile unavailable**\n\n"
            "`KITE_API_KEY` and `KITE_ACCESS_TOKEN` must be set to fetch the profile."
        )

    try:
        from kiteconnect import KiteConnect

        kite = KiteConnect(api_key=settings.kite_api_key)
        kite.set_access_token(settings.kite_access_token)
        profile: dict[str, Any] = kite.profile()
    except Exception as exc:
        return f"**Kite profile error**\n\n{exc}"

    def _fmt_list(value: Any) -> str:
        if isinstance(value, list) and value:
            return ", ".join(str(item) for item in value)
        if isinstance(value, dict) and value:
            parts = []
            for key, val in value.items():
                if isinstance(val, list):
                    parts.append(f"{key}: {', '.join(str(v) for v in val) or '—'}")
                else:
                    parts.append(f"{key}: {val}")
            return "; ".join(parts)
        return "—"

    lines = [
        "# Kite Profile",
        "",
        f"- **User ID**: {profile.get('user_id', '—')}",
        f"- **Name**: {profile.get('user_name', '—')}",
        f"- **Short name**: {profile.get('user_shortname', '—')}",
        f"- **Email**: {profile.get('email', '—')}",
        f"- **Broker**: {profile.get('broker', '—')}",
        f"- **User type**: {profile.get('user_type', '—')}",
        "",
        "## Enabled exchanges",
        f"- {_fmt_list(profile.get('exchanges'))}",
        "",
        "## Enabled products",
        f"- {_fmt_list(profile.get('products'))}",
        "",
        "## Enabled order types",
        f"- {_fmt_list(profile.get('order_types'))}",
    ]

    meta = profile.get("meta")
    if isinstance(meta, dict) and meta:
        lines += ["", "## Meta", f"- {_fmt_list(meta)}"]

    return "\n".join(lines)


def get_kite_margins() -> str:
    """Fetch the user's available funds / margins as Markdown.

    Use this before suggesting order sizing to check how much cash and
    collateral the account actually has. Returns both equity and commodity
    segments when available.

    Returns:
        Markdown string, or a Markdown error block on failure.
    """
    kite, err = _kite_client()
    if err:
        return f"**Kite margins unavailable**\n\n{err}"
    try:
        margins: dict[str, Any] = kite.margins() or {}
    except Exception as exc:
        return f"**Kite margins error**\n\n{exc}"

    lines = ["# Kite Margins"]
    for segment in ("equity", "commodity"):
        seg = margins.get(segment)
        if not isinstance(seg, dict):
            continue
        available = seg.get("available") or {}
        utilised = seg.get("utilised") or {}
        lines += [
            "",
            f"## {segment.title()}",
            f"- **Net**: {_fmt_num(seg.get('net'))}",
            f"- **Live balance**: {_fmt_num(available.get('live_balance'))}",
            f"- **Cash**: {_fmt_num(available.get('cash'))}",
            f"- **Opening balance**: {_fmt_num(available.get('opening_balance'))}",
            f"- **Collateral**: {_fmt_num(available.get('collateral'))}",
            f"- **Intraday payin**: {_fmt_num(available.get('intraday_payin'))}",
            f"- **Utilised debits**: {_fmt_num(utilised.get('debits'))}",
            f"- **Utilised exposure**: {_fmt_num(utilised.get('exposure'))}",
            f"- **M2M realised**: {_fmt_num(utilised.get('m2m_realised'))}",
            f"- **M2M unrealised**: {_fmt_num(utilised.get('m2m_unrealised'))}",
        ]

    if len(lines) == 1:
        lines.append("\n_No margin segments returned._")
    return "\n".join(lines)


def get_kite_holdings() -> str:
    """Fetch the user's long-term equity holdings as a Markdown table.

    Each row includes quantity, average cost, last price, P&L, day change %,
    and product. Use this to understand the user's current exposure before
    recommending new positions.

    Returns:
        Markdown string, or a Markdown error block on failure.
    """
    kite, err = _kite_client()
    if err:
        return f"**Kite holdings unavailable**\n\n{err}"
    try:
        holdings = kite.holdings() or []
    except Exception as exc:
        return f"**Kite holdings error**\n\n{exc}"

    if not holdings:
        return "# Kite Holdings\n\n_No holdings._"

    lines = [
        "# Kite Holdings",
        "",
        "| Symbol | Exchange | Qty | Avg | LTP | P&L | Day Δ% | Product |",
        "|---|---|---:|---:|---:|---:|---:|---|",
    ]
    for h in holdings:
        lines.append(
            "| "
            + " | ".join(
                [
                    str(h.get("tradingsymbol", "—")),
                    str(h.get("exchange", "—")),
                    _fmt_num(h.get("quantity")),
                    _fmt_num(h.get("average_price")),
                    _fmt_num(h.get("last_price")),
                    _fmt_num(h.get("pnl")),
                    _fmt_num(h.get("day_change_percentage")),
                    str(h.get("product", "—")),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def get_kite_positions() -> str:
    """Fetch the user's day + net positions as Markdown tables.

    Kite returns two buckets: `day` (positions opened today) and `net`
    (carry-forward + today combined). Use this to see live intraday and
    F&O exposure before suggesting new trades.

    Returns:
        Markdown string, or a Markdown error block on failure.
    """
    kite, err = _kite_client()
    if err:
        return f"**Kite positions unavailable**\n\n{err}"
    try:
        positions: dict[str, Any] = kite.positions() or {}
    except Exception as exc:
        return f"**Kite positions error**\n\n{exc}"

    def _table(rows: list) -> str:
        if not rows:
            return "_No positions._"
        out = [
            "| Symbol | Exchange | Product | Qty | Avg | LTP | P&L | M2M |",
            "|---|---|---|---:|---:|---:|---:|---:|",
        ]
        for p in rows:
            out.append(
                "| "
                + " | ".join(
                    [
                        str(p.get("tradingsymbol", "—")),
                        str(p.get("exchange", "—")),
                        str(p.get("product", "—")),
                        _fmt_num(p.get("quantity")),
                        _fmt_num(p.get("average_price")),
                        _fmt_num(p.get("last_price")),
                        _fmt_num(p.get("pnl")),
                        _fmt_num(p.get("m2m")),
                    ]
                )
                + " |"
            )
        return "\n".join(out)

    return "\n".join(
        [
            "# Kite Positions",
            "",
            "## Day",
            _table(positions.get("day") or []),
            "",
            "## Net",
            _table(positions.get("net") or []),
        ]
    )


def get_kite_ltp(instruments: list[str]) -> str:
    """Fetch last-traded prices for a list of instruments as a Markdown table.

    Args:
        instruments: List of `"<EXCHANGE>:<TRADINGSYMBOL>"` strings, e.g.
            `["NSE:INFY", "NSE:RELIANCE", "NFO:NIFTY24DECFUT"]`.
            Exchange is one of NSE, BSE, NFO, CDS, BCD, MCX.

    Returns:
        Markdown table with instrument, token, and LTP, or a Markdown error
        block on failure.
    """
    if not instruments:
        return (
            "**Kite LTP error**\n\n"
            "Provide at least one instrument, e.g. `NSE:INFY`."
        )

    kite, err = _kite_client()
    if err:
        return f"**Kite LTP unavailable**\n\n{err}"
    try:
        quotes: dict[str, Any] = kite.ltp(instruments) or {}
    except Exception as exc:
        return f"**Kite LTP error**\n\n{exc}"

    lines = [
        "# Last Traded Prices",
        "",
        "| Instrument | Token | LTP |",
        "|---|---:|---:|",
    ]
    for key in instruments:
        q = quotes.get(key) or {}
        lines.append(
            f"| {key} | {_fmt_num(q.get('instrument_token'))} | {_fmt_num(q.get('last_price'))} |"
        )
    return "\n".join(lines)


def execution_tools() -> list:
    return [place_kite_order]


def account_tools() -> list:
    return [
        get_kite_profile,
        get_kite_margins,
        get_kite_holdings,
        get_kite_positions,
        get_kite_ltp,
    ]
