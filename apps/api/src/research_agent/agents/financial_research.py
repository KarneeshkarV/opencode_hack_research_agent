from agno.agent import Agent
from agno.models.openai import OpenAIResponses
from agno.team import Team, TeamMode

from research_agent.prompts import (
    COMPANY_FINANCIAL_RESEARCH_INSTRUCTIONS,
    COMPANY_FINANCIAL_RESEARCH_ROLE,
    EXECUTION_INSTRUCTIONS,
    EXECUTION_ROLE,
    FUNDAMENTAL_ANALYSIS_INSTRUCTIONS,
    FUNDAMENTAL_ANALYSIS_ROLE,
    MACRO_ECONOMIC_INSTRUCTIONS,
    MACRO_ECONOMIC_ROLE,
    RISK_MANAGEMENT_INSTRUCTIONS,
    RISK_MANAGEMENT_ROLE,
    TEAM_INSTRUCTIONS,
    TECHNICAL_ANALYSIS_INSTRUCTIONS,
    TECHNICAL_ANALYSIS_ROLE,
    TERM_SHEET_INSTRUCTIONS,
    TERM_SHEET_ROLE,
)
from research_agent.settings import get_settings
from research_agent.tools import (
    account_tools,
    execution_tools,
    fundamental_tools,
    macro_tools,
    market_research_tools,
    risk_tools,
    technical_tools,
    term_sheet_tools,
)


def _model() -> OpenAIResponses:
    settings = get_settings()
    return OpenAIResponses(id=settings.model_id, api_key=settings.openai_api_key or None)


def _sub_agent_model() -> OpenAIResponses:
    settings = get_settings()
    return OpenAIResponses(id="gpt-5.4-mini", api_key=settings.openai_api_key or None)


def build_company_financial_research_agent() -> Agent:
    return Agent(
        id="company-financial-research-agent",
        name="Company Financial Research Agent",
        role=COMPANY_FINANCIAL_RESEARCH_ROLE,
        model=_sub_agent_model(),
        tools=market_research_tools(),
        instructions=COMPANY_FINANCIAL_RESEARCH_INSTRUCTIONS,
        markdown=True,
        add_datetime_to_context=True,
    )


def build_macro_economic_agent() -> Agent:
    return Agent(
        id="macro-economic-agent",
        name="Macro Economic Agent",
        role=MACRO_ECONOMIC_ROLE,
        model=_sub_agent_model(),
        tools=macro_tools(),
        instructions=MACRO_ECONOMIC_INSTRUCTIONS,
        markdown=True,
        add_datetime_to_context=True,
    )


def build_term_sheet_agent() -> Agent:
    return Agent(
        id="term-sheet-agent",
        name="Term Sheet Agent",
        role=TERM_SHEET_ROLE,
        model=_sub_agent_model(),
        tools=term_sheet_tools(),
        instructions=TERM_SHEET_INSTRUCTIONS,
        markdown=True,
        add_datetime_to_context=True,
    )


def build_technical_analysis_agent() -> Agent:
    return Agent(
        id="technical-analysis-agent",
        name="Technical Analysis Agent",
        role=TECHNICAL_ANALYSIS_ROLE,
        model=_sub_agent_model(),
        tools=technical_tools(),
        instructions=TECHNICAL_ANALYSIS_INSTRUCTIONS,
        markdown=True,
        add_datetime_to_context=True,
    )


def build_fundamental_analysis_agent() -> Agent:
    return Agent(
        id="fundamental-analysis-agent",
        name="Fundamental Analysis Agent",
        role=FUNDAMENTAL_ANALYSIS_ROLE,
        model=_sub_agent_model(),
        tools=fundamental_tools(),
        instructions=FUNDAMENTAL_ANALYSIS_INSTRUCTIONS,
        markdown=True,
        add_datetime_to_context=True,
    )


def build_risk_management_agent() -> Agent:
    return Agent(
        id="risk-management-agent",
        name="Risk Management Agent",
        role=RISK_MANAGEMENT_ROLE,
        model=_sub_agent_model(),
        tools=risk_tools(),
        instructions=RISK_MANAGEMENT_INSTRUCTIONS,
        markdown=True,
        add_datetime_to_context=True,
    )


def build_execution_agent() -> Agent:
    return Agent(
        id="execution-agent",
        name="Execution Agent",
        role=EXECUTION_ROLE,
        model=_sub_agent_model(),
        tools=execution_tools(),
        instructions=EXECUTION_INSTRUCTIONS,
        markdown=True,
        add_datetime_to_context=True,
    )


def build_financial_research_agents() -> list[Agent]:
    return [
        build_company_financial_research_agent(),
        build_macro_economic_agent(),
        build_term_sheet_agent(),
        build_technical_analysis_agent(),
        build_fundamental_analysis_agent(),
        build_risk_management_agent(),
        build_execution_agent(),
    ]


def build_financial_research_team(members: list[Agent] | None = None) -> Team:
    return Team(
        id="financial-research-team",
        name="Financial Research Team",
        mode=TeamMode.coordinate,
        model=_model(),
        members=members or build_financial_research_agents(),
        tools=account_tools(),
        instructions=TEAM_INSTRUCTIONS,
        markdown=True,
        add_datetime_to_context=True,
        share_member_interactions=True,
        show_members_responses=False,
    )


financial_research_agents = build_financial_research_agents()
financial_research_team = build_financial_research_team(financial_research_agents)
