"""Shared pytest fixtures using an isolated SQLite database."""

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("COOKIE_PATH", "/")
os.environ.setdefault("ROOT_PATH", "")
os.environ.setdefault("LOG_FILE", "logs/test.log")

from app.config import get_settings

get_settings.cache_clear()

from app.database import Base, get_db
from app.main import create_app
from app.utils.cookies import CookieManager


engine = create_engine(
    "sqlite+pysqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    """Provide a clean database for each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db: Session) -> Generator[TestClient, None, None]:
    """HTTP client wired to the test database."""
    app = create_app()

    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers_user(client: TestClient) -> TestClient:
    """Register a default user and return the authenticated client."""
    response = client.post(
        "/api/v1/auth/registration",
        json={
            "login": "testuser",
            "password": "secret1",
            "name": "Иван",
            "surname": "Петров",
        },
    )
    assert response.status_code == 201
    return client


def register_user(client: TestClient, login: str = "testuser", password: str = "secret1") -> None:
    """Helper to register a user via API."""
    response = client.post(
        "/api/v1/auth/registration",
        json={
            "login": login,
            "password": password,
            "name": "Иван",
            "surname": "Петров",
        },
    )
    assert response.status_code == 201


def analysis_payload(**overrides):
    """Build a valid analysis create payload."""
    data = {
        "name": "Глюкоза",
        "date": "2025-01-15",
        "value": 5.5,
        "ref_upper": 6.1,
        "ref_lower": 3.9,
        "organization": "Инвитро",
        "note": "натощак",
    }
    data.update(overrides)
    return data
