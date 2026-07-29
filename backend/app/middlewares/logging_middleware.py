"""JSON request/response logging middleware."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import get_settings
from app.services.auth_service import AuthService
from app.utils.cookies import CookieManager

SENSITIVE_KEYS = {"password", "access_token", "refresh_token", "token"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every API call as a JSON line into a shared text file."""

    def __init__(self, app) -> None:
        super().__init__(app)
        self.settings = get_settings()
        self.auth_service = AuthService()
        Path(self.settings.log_file).parent.mkdir(parents=True, exist_ok=True)

    def _mask(self, data: Any) -> Any:
        if isinstance(data, dict):
            masked = {}
            for key, value in data.items():
                if key.lower() in SENSITIVE_KEYS:
                    masked[key] = "********"
                else:
                    masked[key] = self._mask(value)
            return masked
        if isinstance(data, list):
            return [self._mask(item) for item in data]
        return data

    async def dispatch(self, request: Request, call_next) -> Response:
        body_data: Any = None
        errors: Any = None
        raw_body = await request.body()
        if raw_body:
            try:
                body_data = self._mask(json.loads(raw_body.decode("utf-8")))
            except (json.JSONDecodeError, UnicodeDecodeError):
                body_data = "***non-json-body***"

        async def receive():
            return {"type": "http.request", "body": raw_body, "more_body": False}

        request = Request(request.scope, receive)
        response = await call_next(request)

        user_id = getattr(request.state, "user_id", None)
        if user_id is None:
            access = request.cookies.get(CookieManager.ACCESS_COOKIE)
            user_id = self.auth_service.get_user_id_from_access(access)

        if response.status_code >= 400:
            errors = f"status={response.status_code}"

        log_entry = {
            "timestamp": datetime.now().strftime("%d.%m.%Y %H:%M:%S.%f")[:-3],
            "path": request.url.path,
            "user_id": user_id,
            "status_response": response.status_code,
            "additional_params": {"body": body_data, "errors": errors},
        }
        with open(self.settings.log_file, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        return response
