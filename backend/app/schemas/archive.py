"""Pydantic schemas for archive files."""

from datetime import datetime

from pydantic import BaseModel, Field


class ArchiveFileResponse(BaseModel):
    """Archive file metadata returned to the client."""

    id: int
    original_name: str
    note: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ArchiveLimitsResponse(BaseModel):
    """Upload limits for the archive feature."""

    max_bytes: int = Field(description="Maximum stored file size in bytes (after compression)")
    upload_max_bytes: int = Field(description="Maximum raw upload size before compression")
