"""Analysis API routes."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.database import get_db
from app.schemas.analyses import AnalysisCreate, AnalysisResponse
from app.services.analyses_service import AnalysesService

router = APIRouter(prefix="/analyses", tags=["analyses"])
analyses_service = AnalysesService()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AnalysisResponse)
def create_analysis(
    payload: AnalysisCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> AnalysisResponse:
    """Create a new analysis for the authenticated user."""
    analysis = analyses_service.create(db, user_id, payload)
    return AnalysisResponse.model_validate(analysis)


@router.get("", response_model=list[AnalysisResponse])
def list_analyses(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> list[AnalysisResponse]:
    """Return all analyses owned by the authenticated user."""
    items = analyses_service.list_for_user(db, user_id)
    return [AnalysisResponse.model_validate(item) for item in items]


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> Response:
    """Delete an analysis belonging to the authenticated user."""
    analyses_service.delete(db, user_id, analysis_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
