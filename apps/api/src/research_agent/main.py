from agno.os import AgentOS
from fastapi import FastAPI

from research_agent.agents import financial_research_agents, financial_research_team
from research_agent.settings import get_settings

settings = get_settings()

base_app = FastAPI(title=settings.app_name)


@base_app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


agent_os = AgentOS(
    name=settings.app_name,
    agents=financial_research_agents,
    teams=[financial_research_team],
    base_app=base_app,
    tracing=True,
)

app = agent_os.get_app()


def main() -> None:
    agent_os.serve(app="research_agent.main:app", reload=True)


if __name__ == "__main__":
    main()
