"""Langfuse / OpenTelemetry wiring.

Must be imported and `setup_telemetry()` called before any Agno agent, OpenAI
client, or httpx client is constructed — instrumentors patch classes at import
time and only affect instances created afterwards.
"""

from __future__ import annotations

import atexit
import base64
import logging
import os

from research_agent.settings import get_settings

logger = logging.getLogger(__name__)

_initialized = False
_enabled = False
_tracer_provider = None


def setup_telemetry() -> None:
    """Initialize the OTLP exporter to Langfuse and instrument the LLM stack.

    No-ops cleanly if `langfuse_enabled` is false or credentials are missing.
    Safe to call more than once (subsequent calls are ignored).
    """
    global _initialized, _enabled, _tracer_provider
    if _initialized:
        return
    _initialized = True

    settings = get_settings()
    if not settings.langfuse_enabled:
        logger.info("telemetry: disabled via LANGFUSE_ENABLED=false")
        return
    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        logger.warning(
            "telemetry: LANGFUSE_PUBLIC_KEY/SECRET_KEY not set — skipping Langfuse setup"
        )
        return

    auth = base64.b64encode(
        f"{settings.langfuse_public_key}:{settings.langfuse_secret_key}".encode()
    ).decode()
    endpoint = f"{settings.langfuse_host.rstrip('/')}/api/public/otel"
    os.environ.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint)
    os.environ.setdefault("OTEL_EXPORTER_OTLP_HEADERS", f"Authorization=Basic {auth}")

    from opentelemetry import trace as trace_api
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    resource = Resource.create(
        {
            "service.name": settings.service_name,
            "service.version": settings.service_version,
            "deployment.environment": settings.environment,
        }
    )
    _tracer_provider = TracerProvider(resource=resource)
    _tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    if os.environ.get("OTEL_DEBUG_CONSOLE") == "1":
        from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

        _tracer_provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace_api.set_tracer_provider(_tracer_provider)

    from openinference.instrumentation.agno import AgnoInstrumentor
    from openinference.instrumentation.openai import OpenAIInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

    AgnoInstrumentor().instrument(tracer_provider=_tracer_provider)
    OpenAIInstrumentor().instrument(tracer_provider=_tracer_provider)
    HTTPXClientInstrumentor().instrument(tracer_provider=_tracer_provider)

    atexit.register(_shutdown)
    _enabled = True
    logger.info(
        "telemetry: langfuse enabled host=%s service=%s env=%s",
        settings.langfuse_host,
        settings.service_name,
        settings.environment,
    )


def instrument_fastapi(app) -> None:
    """Add FastAPI request spans (route, status, latency) to `app`.

    Call after `AgentOS.get_app()` so AgentOS's auto-generated routes are
    covered too. No-op when telemetry is disabled.
    """
    if not _enabled:
        return
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    FastAPIInstrumentor.instrument_app(app, tracer_provider=_tracer_provider)


def is_enabled() -> bool:
    return _enabled


def _shutdown() -> None:
    if _tracer_provider is not None:
        try:
            _tracer_provider.shutdown()
        except Exception:
            logger.exception("telemetry: tracer provider shutdown failed")
