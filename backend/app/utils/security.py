"""Password hashing utilities."""

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class PasswordHasher:
    """Hash and verify user passwords with bcrypt."""

    def hash(self, password: str) -> str:
        """Create a bcrypt hash for a plain password."""
        return pwd_context.hash(password)

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        """Check whether a plain password matches the stored hash."""
        return pwd_context.verify(plain_password, hashed_password)
