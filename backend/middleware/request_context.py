"""Request-context middleware: x-request-id header round-trip."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from observability import begin_request, clear_user_context


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Read/generate x-request-id, populate the request ContextVar, echo back.

    Mounted outermost in ``main.py`` so it wraps CORS and all routers.
    Clears user context in ``finally`` to avoid leakage across requests
    that share an asyncio task.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        rid = begin_request(request.headers.get("x-request-id"))
        try:
            response = await call_next(request)
            response.headers["x-request-id"] = rid
            return response
        finally:
            clear_user_context()
