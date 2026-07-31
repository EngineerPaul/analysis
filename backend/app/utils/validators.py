"""Shared validation helpers and regex patterns."""

import re

LOGIN_PATTERN = re.compile(r"^[a-zA-Z0-9]{6,20}$")
NAME_PATTERN = re.compile(r"^[a-zA-Zа-яА-ЯёЁ]{2,30}$")
ANALYSIS_NAME_PATTERN = re.compile(r"^[a-zA-Zа-яА-ЯёЁ0-9 ]{1,60}$")
ORGANIZATION_PATTERN = re.compile(r'^[a-zA-Zа-яА-ЯёЁ0-9 "\']{0,30}$')
CYRILLIC_PATTERN = re.compile(r"[а-яА-ЯёЁ]")
FORBIDDEN_PASSWORD_CHARS = {"\t", "\n", "\r", "\0"}


def validate_password_chars(password: str) -> str:
    """Reject passwords with Cyrillic, control chars, or invalid length."""
    if CYRILLIC_PATTERN.search(password):
        raise ValueError("Password must not contain Cyrillic letters")
    if any(char in password for char in FORBIDDEN_PASSWORD_CHARS):
        raise ValueError("Password contains forbidden characters")
    if not 6 <= len(password) <= 20:
        raise ValueError("Password length must be between 6 and 20")
    return password
