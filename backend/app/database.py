"""Database engine and session factory."""

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""


def _ensure_sqlite_directory(database_url: str) -> None:
    """Create parent directory for a file-based SQLite database."""
    if not database_url.startswith("sqlite:///"):
        return
    # sqlite:///rel.db -> rel.db ; sqlite:////data/db.sqlite -> /data/db.sqlite
    raw_path = database_url.removeprefix("sqlite:///")
    if not raw_path or raw_path == ":memory:" or raw_path.startswith("file:"):
        return
    Path(raw_path).parent.mkdir(parents=True, exist_ok=True)


def _build_engine() -> Engine:
    """Create SQLAlchemy engine with SQLite-friendly options when needed."""
    settings = get_settings()
    url = settings.database_url
    if url.startswith("sqlite"):
        _ensure_sqlite_directory(url)
        engine = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine
    return create_engine(url, pool_pre_ping=True)


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all database tables."""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
