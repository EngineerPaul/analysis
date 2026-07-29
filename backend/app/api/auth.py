"""Authentication API routes."""

from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import LoginRequest, MessageResponse, RegistrationRequest
from app.services.auth_service import AuthService
from app.utils.cookies import CookieManager

router = APIRouter(prefix="/auth", tags=["auth"])
auth_service = AuthService()
cookie_manager = CookieManager()


@router.post("/registration", status_code=status.HTTP_201_CREATED, response_model=MessageResponse)
def register(
    payload: RegistrationRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Register a new user and set auth cookies."""
    user = auth_service.register(db, payload)
    access, refresh = auth_service.issue_tokens(user.id)
    cookie_manager.set_tokens(response, access, refresh)
    return MessageResponse(message="Registered successfully")


@router.post("/login", response_model=MessageResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Authenticate a user and set auth cookies."""
    user = auth_service.authenticate(db, payload)
    access, refresh = auth_service.issue_tokens(user.id)
    cookie_manager.set_tokens(response, access, refresh)
    return MessageResponse(message="Logged in successfully")


@router.post("/logout", response_model=MessageResponse)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias=CookieManager.REFRESH_COOKIE),
) -> MessageResponse:
    """Clear cookies and blacklist the current refresh token."""
    auth_service.blacklist_refresh(db, refresh_token)
    cookie_manager.clear_tokens(response)
    return MessageResponse(message="Logged out successfully")


@router.post("/refresh", response_model=MessageResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias=CookieManager.REFRESH_COOKIE),
) -> MessageResponse:
    """Rotate tokens using a valid refresh cookie."""
    access, new_refresh = auth_service.refresh_tokens(db, refresh_token)
    cookie_manager.set_tokens(response, access, new_refresh)
    return MessageResponse(message="Tokens refreshed")
