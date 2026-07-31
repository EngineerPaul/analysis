"""Pydantic schemas for authentication."""

from pydantic import BaseModel, Field, field_validator

from app.utils.validators import (
    CYRILLIC_PATTERN,
    LOGIN_PATTERN,
    NAME_PATTERN,
    validate_password_chars,
)


class RegistrationRequest(BaseModel):
    """Payload for user registration."""

    login: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=6, max_length=20)
    name: str = Field(min_length=2, max_length=30)
    surname: str = Field(min_length=2, max_length=30)

    @field_validator("login")
    @classmethod
    def check_login(cls, value: str) -> str:
        if CYRILLIC_PATTERN.search(value):
            raise ValueError("Login must not contain Cyrillic letters")
        if not LOGIN_PATTERN.fullmatch(value):
            raise ValueError("Login must contain only Latin letters and digits")
        return value

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        return validate_password_chars(value)

    @field_validator("name", "surname")
    @classmethod
    def check_name(cls, value: str) -> str:
        if not NAME_PATTERN.fullmatch(value):
            raise ValueError("Name fields must contain only Russian or English letters")
        return value


class LoginRequest(BaseModel):
    """Payload for user login."""

    login: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=6, max_length=20)

    @field_validator("login")
    @classmethod
    def check_login(cls, value: str) -> str:
        if CYRILLIC_PATTERN.search(value):
            raise ValueError("Login must not contain Cyrillic letters")
        if not LOGIN_PATTERN.fullmatch(value):
            raise ValueError("Login must contain only Latin letters and digits")
        return value

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        return validate_password_chars(value)


class MessageResponse(BaseModel):
    """Generic message response."""

    message: str
