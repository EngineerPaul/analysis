"""FastAPI dependencies for authentication."""

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import AuthService
from app.utils.cookies import CookieManager


def get_current_user_id(
    request: Request,
    access_token: str | None = Cookie(default=None, alias=CookieManager.ACCESS_COOKIE),
    db: Session = Depends(get_db),
) -> int:
    """Require a valid access token and return the user id."""
    del db  # reserved for future blacklist checks on access tokens
    auth_service = AuthService()
    user_id = auth_service.get_user_id_from_access(access_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    request.state.user_id = user_id
    return user_id
