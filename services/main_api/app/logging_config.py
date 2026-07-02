import contextvars
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# Holds the correlation ID for the current request / asyncio task.
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


class JsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(""),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Attach a UUID correlation ID to every request and expose it as X-Request-ID."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        correlation_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        token = request_id_var.set(correlation_id)
        try:
            response: Response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers["X-Request-ID"] = correlation_id
        return response


def configure_logging() -> None:
    """Replace the root logger's handlers with a JSON stream handler."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.INFO)
