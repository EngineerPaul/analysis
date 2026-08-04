"""Archive files business logic."""

from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.archive import ArchiveFile
from app.utils.archive_compress import prepare_archive_payload


class ArchiveService:
    """Stores and serves user archive files on disk."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.root = Path(settings.archive_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    def get_owned(self, db: Session, user_id: int, file_id: int) -> ArchiveFile:
        """Load archive row owned by the user or raise 404."""
        item = (
            db.query(ArchiveFile)
            .filter(ArchiveFile.id == file_id, ArchiveFile.user_id == user_id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        return item

    def list_for_user(self, db: Session, user_id: int) -> list[ArchiveFile]:
        """Return archive files of a user, newest first."""
        return (
            db.query(ArchiveFile)
            .filter(ArchiveFile.user_id == user_id)
            .order_by(desc(ArchiveFile.created_at), desc(ArchiveFile.id))
            .all()
        )

    async def create(
        self,
        db: Session,
        user_id: int,
        note: str,
        upload: UploadFile,
    ) -> ArchiveFile:
        """Validate, optionally compress, save file to disk and create DB row."""
        note = (note or "").strip()
        if len(note) > 200:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Note must be at most 200 characters",
            )

        original = (upload.filename or "file").strip() or "file"
        original = original.replace("\\", "/").split("/")[-1][:255]

        data = await upload.read()
        if not data:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty file")

        upload_limit = self.settings.archive_upload_max_bytes
        store_limit = self.settings.archive_max_bytes
        if len(data) > upload_limit:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds upload limit of {upload_limit} bytes",
            )

        try:
            data, original = prepare_archive_payload(data, original, store_limit)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=str(exc),
            ) from exc

        size = len(data)
        suffix = Path(original).suffix[:20]
        stored_name = f"{uuid4().hex}{suffix}"
        path = self.root / stored_name
        path.write_bytes(data)

        item = ArchiveFile(
            user_id=user_id,
            stored_name=stored_name,
            original_name=original,
            note=note,
            size_bytes=size,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def absolute_path(self, item: ArchiveFile) -> Path:
        """Resolve on-disk path for an archive row."""
        path = self.root / item.stored_name
        if not path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")
        return path

    def delete(self, db: Session, user_id: int, file_id: int) -> None:
        """Delete DB row and remove file from disk if present."""
        item = self.get_owned(db, user_id, file_id)
        path = self.root / item.stored_name
        db.delete(item)
        db.commit()
        if path.is_file():
            path.unlink()
