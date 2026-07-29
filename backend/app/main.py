"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config import get_settings
from app.database import init_db
from app.middlewares.logging_middleware import RequestLoggingMiddleware


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()
    app = FastAPI(title="Мои анализы", root_path=settings.root_path)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    app.include_router(api_router)

    @app.on_event("startup")
    def on_startup() -> None:
        """Initialize database schema on startup."""
        init_db()

    @app.get("/health")
    def health() -> dict[str, str]:
        """Simple health-check endpoint."""
        return {"status": "ok"}

    return app


app = create_app()
