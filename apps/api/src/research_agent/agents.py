from agno.agent import Agent
from agno.models.openai import OpenAIResponses

from research_agent.settings import get_settings


def build_research_agent() -> Agent:
    settings = get_settings()

    return Agent(
        id="research-agent",
        name="Research Agent",
        model=OpenAIResponses(id=settings.model_id),
        instructions=[
            "You are a concise research agent.",
            "Ask clarifying questions only when the user's request is ambiguous.",
            "Return practical findings, tradeoffs, and next steps.",
        ],
        markdown=True,
        add_datetime_to_context=True,
    )


research_agent = build_research_agent()
