"""Authentication and user-related business logic."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.models.refresh_blacklist import RefreshBlacklist
from app.models.user import User
from app.schemas.auth import LoginRequest, RegistrationRequest
from app.utils.security import PasswordHasher
from app.utils.tokens import TokenManager


class AuthService:
    """Handles registration, login and token lifecycle."""

    def __init__(self) -> None:
        self.hasher = PasswordHasher()
        self.tokens = TokenManager()

    def register(self, db: Session, payload: RegistrationRequest) -> User:
        """Create a new user or raise 409 if login is taken."""
        existing = db.query(User).filter(User.login == payload.login).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Login already taken")
        user = User(
            login=payload.login,
            password_hash=self.hasher.hash(payload.password),
            name=payload.name,
            surname=payload.surname,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def authenticate(self, db: Session, payload: LoginRequest) -> User:
        """Validate credentials and return the matching user."""
        user = db.query(User).filter(User.login == payload.login).first()
        if not user or not self.hasher.verify(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid login or password",
            )
        return user

    def issue_tokens(self, user_id: int) -> tuple[str, str]:
        """Create access and refresh tokens for a user."""
        access = self.tokens.create_access_token(user_id)
        refresh, _, _ = self.tokens.create_refresh_token(user_id)
        return access, refresh

    def blacklist_refresh(self, db: Session, refresh_token: str | None) -> None:
        """Add a refresh token jti to the blacklist if the token is valid."""
        if not refresh_token:
            return
        try:
            payload = self.tokens.decode_token(refresh_token)
        except JWTError:
            return
        if payload.get("type") != "refresh":
            return
        jti = payload.get("jti")
        exp = payload.get("exp")
        if not jti or not exp:
            return
        exists = db.query(RefreshBlacklist).filter(RefreshBlacklist.jti == jti).first()
        if exists:
            return
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
        db.add(RefreshBlacklist(jti=jti, expires_at=expires_at))
        db.commit()

    def refresh_tokens(self, db: Session, refresh_token: str | None) -> tuple[str, str]:
        """Rotate refresh token and return a new token pair."""
        if not refresh_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")
        try:
            payload = self.tokens.decode_token(refresh_token)
        except JWTError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token type")
        jti = payload.get("jti")
        if not jti:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        blacklisted = db.query(RefreshBlacklist).filter(RefreshBlacklist.jti == jti).first()
        if blacklisted:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
        user_id = int(payload["sub"])
        self.blacklist_refresh(db, refresh_token)
        return self.issue_tokens(user_id)

    def get_user_id_from_access(self, token: str | None) -> int | None:
        """Extract user id from access token or return None."""
        if not token:
            return None
        try:
            payload = self.tokens.decode_token(token)
        except JWTError:
            return None
        if payload.get("type") != "access":
            return None
        return int(payload["sub"])

    def get_user(self, db: Session, user_id: int) -> User:
        """Load user by id or raise 401 if missing."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        return user
