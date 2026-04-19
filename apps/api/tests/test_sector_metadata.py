from research_agent import main


def test_parse_sector_industry_from_company_info_json() -> None:
    sector, industry = main._parse_sector_industry(
        '{"Sector": "Communication Services", "Industry": "Entertainment"}'
    )

    assert sector == "Communication Services"
    assert industry == "Entertainment"


def test_extract_sector_industry_uses_agent_markdown_without_ticker() -> None:
    sector, industry = main._extract_sector_industry(
        [
            {
                "agent_id": "company-financial-research-agent",
                "content": "## Snapshot\n- **Sector:** Technology\n- **Industry:** Software\n",
            }
        ],
    )

    assert sector == "Technology"
    assert industry == "Software"


def test_extract_sector_industry_prefers_company_info_even_when_agent_has_metadata(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        main,
        "_fetch_sector_industry",
        lambda ticker: ("Communication Services", "Entertainment"),
    )

    sector, industry = main._extract_sector_industry(
        [
            {
                "agent_id": "company-financial-research-agent",
                "content": "## Snapshot\n- **Sector:** Technology\n- **Industry:** Software\n",
            }
        ],
        ticker="NFLX",
    )

    assert sector == "Communication Services"
    assert industry == "Entertainment"


def test_extract_sector_industry_uses_agent_markdown_for_missing_company_info(
    monkeypatch,
) -> None:
    monkeypatch.setattr(main, "_fetch_sector_industry", lambda ticker: ("", "Entertainment"))

    sector, industry = main._extract_sector_industry(
        [
            {
                "agent_id": "company-financial-research-agent",
                "content": (
                    "## Snapshot\n"
                    "- **Sector:** Communication Services\n"
                    "- **Industry:** Media\n"
                ),
            }
        ],
        ticker="NFLX",
    )

    assert sector == "Communication Services"
    assert industry == "Entertainment"
