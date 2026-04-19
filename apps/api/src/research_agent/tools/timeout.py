from collections.abc import Callable
from multiprocessing import get_context
from typing import Any

from opentelemetry import trace


def call_with_timeout(
    name: str,
    timeout_seconds: int,
    target: Callable[..., str],
    *args: Any,
    **kwargs: Any,
) -> str:
    """Run a blocking external tool in a child process with a hard timeout."""
    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("tool.execute") as span:
        span.set_attribute("tool.name", name)
        span.set_attribute("tool.timeout_seconds", timeout_seconds)

        if timeout_seconds <= 0:
            try:
                result = target(*args, **kwargs)
                span.set_attribute("tool.outcome", "ok")
                return result
            except Exception as exc:
                span.set_attribute("tool.outcome", "error")
                span.record_exception(exc)
                raise

        ctx = get_context("fork")
        parent_conn, child_conn = ctx.Pipe(duplex=False)
        process = ctx.Process(
            target=_run_target,
            args=(child_conn, target, args, kwargs),
            daemon=True,
        )

        try:
            process.start()
            child_conn.close()

            if not parent_conn.poll(timeout_seconds):
                process.terminate()
                process.join(2)
                if process.is_alive():
                    process.kill()
                    process.join()
                span.set_attribute("tool.outcome", "timeout")
                return f"Error running {name}: timed out after {timeout_seconds} seconds"

            ok, value = parent_conn.recv()
            process.join(2)

            if ok:
                span.set_attribute("tool.outcome", "ok")
                return value
            span.set_attribute("tool.outcome", "error")
            span.set_attribute("tool.error", str(value)[:512])
            return f"Error running {name}: {value}"
        except Exception as exc:
            span.set_attribute("tool.outcome", "error")
            span.record_exception(exc)
            return f"Error running {name}: {exc}"
        finally:
            parent_conn.close()
            if not child_conn.closed:
                child_conn.close()


def _run_target(
    result_conn: Any,
    target: Callable[..., str],
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> None:
    try:
        result_conn.send((True, target(*args, **kwargs)))
    except Exception as exc:
        result_conn.send((False, str(exc)))
    finally:
        result_conn.close()
