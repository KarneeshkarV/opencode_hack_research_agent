from collections.abc import Callable
from multiprocessing import get_context
from typing import Any


def call_with_timeout(
    name: str,
    timeout_seconds: int,
    target: Callable[..., str],
    *args: Any,
    **kwargs: Any,
) -> str:
    """Run a blocking external tool in a child process with a hard timeout."""
    if timeout_seconds <= 0:
        return target(*args, **kwargs)

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
            return f"Error running {name}: timed out after {timeout_seconds} seconds"

        ok, value = parent_conn.recv()
        process.join(2)

        if ok:
            return value
        return f"Error running {name}: {value}"
    except Exception as exc:
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
