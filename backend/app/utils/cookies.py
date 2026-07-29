"""Cookie helpers for JWT tokens."""

from fastapi import Response

from app.config import get_settings


class CookieManager:
    """Set and clear HttpOnly auth cookies."""

    ACCESS_COOKIE = "access_token"
    REFRESH_COOKIE = "refresh_token"

    def __init__(self) -> None:
        self.settings = get_settings()

    def _cookie_kwargs(self, max_age: int) -> dict:
        return {
            "httponly": True,
            "secure": self.settings.cookie_secure,
            "samesite": self.settings.cookie_samesite,
            "path": self.settings.cookie_path,
            "max_age": max_age,
        }

    def set_tokens(self, response: Response, access: str, refresh: str) -> None:
        """Attach access and refresh cookies to the response."""
        access_age = self.settings.access_token_expire_days * 24 * 60 * 60
        refresh_age = self.settings.refresh_token_expire_days * 24 * 60 * 60
        response.set_cookie(self.ACCESS_COOKIE, access, **self._cookie_kwargs(access_age))
        response.set_cookie(self.REFRESH_COOKIE, refresh, **self._cookie_kwargs(refresh_age))

    def clear_tokens(self, response: Response) -> None:
        """Remove auth cookies from the client."""
        response.delete_cookie(
            self.ACCESS_COOKIE,
            path=self.settings.cookie_path,
            secure=self.settings.cookie_secure,
            httponly=True,
            samesite=self.settings.cookie_samesite,
        )
        response.delete_cookie(
            self.REFRESH_COOKIE,
            path=self.settings.cookie_path,
            secure=self.settings.cookie_secure,
            httponly=True,
            samesite=self.settings.cookie_samesite,
        )
