"""JWT token helpers."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt

from app.config import get_settings


class TokenManager:
    """Create and decode JWT access/refresh tokens."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def create_access_token(self, user_id: int) -> str:
        """Build a short-lived access token for the given user."""
        expire = datetime.now(timezone.utc) + timedelta(days=self.settings.access_token_expire_days)
        payload = {"sub": str(user_id), "type": "access", "exp": expire, "jti": uuid4().hex}
        return jwt.encode(payload, self.settings.secret_key, algorithm=self.settings.algorithm)

    def create_refresh_token(self, user_id: int) -> tuple[str, str, datetime]:
        """Build a refresh token and return token, jti and expiry."""
        expire = datetime.now(timezone.utc) + timedelta(days=self.settings.refresh_token_expire_days)
        jti = uuid4().hex
        payload = {"sub": str(user_id), "type": "refresh", "exp": expire, "jti": jti}
        token = jwt.encode(payload, self.settings.secret_key, algorithm=self.settings.algorithm)
        return token, jti, expire

    def decode_token(self, token: str) -> dict[str, Any]:
        """Decode a JWT or raise JWTError."""
        return jwt.decode(token, self.settings.secret_key, algorithms=[self.settings.algorithm])
