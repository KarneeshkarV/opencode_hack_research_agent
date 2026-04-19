"""One-shot helper to exchange a Kite request_token for an access_token.

Usage:
    cd apps/api
    uv run python scripts/kite_login.py

Requires KITE_API_KEY and KITE_API_SECRET in the repo-root .env.
Writes the generated access_token back into that same .env as KITE_ACCESS_TOKEN.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from kiteconnect import KiteConnect

from research_agent.settings import ROOT_DIR, get_settings


def _upsert_env(env_path: Path, key: str, value: str) -> None:
    line = f"{key}={value}"
    if not env_path.exists():
        env_path.write_text(line + "\n", encoding="utf-8")
        return
    text = env_path.read_text(encoding="utf-8")
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    new_text = pattern.sub(line, text) if pattern.search(text) else text.rstrip() + f"\n{line}\n"
    env_path.write_text(new_text, encoding="utf-8")


def _extract_request_token(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("http"):
        query = parse_qs(urlparse(raw).query)
        if "request_token" in query:
            return query["request_token"][0]
    return raw


def main() -> int:
    get_settings.cache_clear()
    settings = get_settings()
    if not settings.kite_api_key or not settings.kite_api_secret:
        print("KITE_API_KEY and KITE_API_SECRET must be set in .env first.", file=sys.stderr)
        return 1

    kite = KiteConnect(api_key=settings.kite_api_key)
    print("\n1. Open this URL in a browser and log in:\n")
    print(f"   {kite.login_url()}\n")
    print("2. After login, Kite redirects to your redirect URL with ?request_token=XXX in it.")
    print("   Paste either the full redirected URL or just the request_token value below.\n")

    user_input = input("request_token: ")
    request_token = _extract_request_token(user_input)
    if not request_token:
        print("No request_token provided.", file=sys.stderr)
        return 1

    session = kite.generate_session(request_token, api_secret=settings.kite_api_secret)
    access_token = session["access_token"]

    env_path = ROOT_DIR / ".env"
    _upsert_env(env_path, "KITE_ACCESS_TOKEN", access_token)
    get_settings.cache_clear()

    print(f"\nAccess token generated for user_id={session.get('user_id')}.")
    print(f"Written to {env_path}.")
    print("Token expires at ~6 AM IST tomorrow — rerun this script daily.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
