from research_agent.telemetry import instrument_fastapi, setup_telemetry

setup_telemetry()

from agno.os import AgentOS  # noqa: E402
from fastapi import FastAPI  # noqa: E402

from research_agent.agents import financial_research_agents, financial_research_team  # noqa: E402
from research_agent.settings import get_settings  # noqa: E402

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
    on_route_conflict="preserve_base_app",
    tracing=False,
)

app = agent_os.get_app()
instrument_fastapi(app)


def main() -> None:
    agent_os.serve(app="research_agent.main:app", reload=True)


if __name__ == "__main__":
    main()
