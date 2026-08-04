"""Archive file API routes."""

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.config import get_settings
from app.database import get_db
from app.schemas.archive import ArchiveFileResponse, ArchiveLimitsResponse
from app.services.archive_service import ArchiveService

router = APIRouter(prefix="/archive", tags=["archive"])


def _service() -> ArchiveService:
    return ArchiveService(get_settings())


@router.get("/limits", response_model=ArchiveLimitsResponse)
def archive_limits() -> ArchiveLimitsResponse:
    """Return current upload size limits."""
    settings = get_settings()
    return ArchiveLimitsResponse(
        max_bytes=settings.archive_max_bytes,
        upload_max_bytes=settings.archive_upload_max_bytes,
    )


@router.get("", response_model=list[ArchiveFileResponse])
def list_archive(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> list[ArchiveFileResponse]:
    """List archive files for the authenticated user."""
    items = _service().list_for_user(db, user_id)
    return [ArchiveFileResponse.model_validate(item) for item in items]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ArchiveFileResponse)
async def upload_archive(
    note: str = Form(default=""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> ArchiveFileResponse:
    """Upload a file into the user archive."""
    item = await _service().create(db, user_id, note, file)
    return ArchiveFileResponse.model_validate(item)


@router.get("/{file_id}/download")
def download_archive(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> FileResponse:
    """Download an archive file."""
    service = _service()
    item = service.get_owned(db, user_id, file_id)
    path = service.absolute_path(item)
    return FileResponse(
        path=path,
        filename=item.original_name,
        media_type="application/octet-stream",
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_archive(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> None:
    """Delete an archive file."""
    _service().delete(db, user_id, file_id)
