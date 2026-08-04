"""Archive file ORM model."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ArchiveFile(Base):
    """User-uploaded file stored on disk under a generated name."""

    __tablename__ = "archive_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stored_name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="archive_files")
