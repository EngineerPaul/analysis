"""Analyses CRUD business logic."""

from fastapi import HTTPException, status
from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.models.analyses import Analysis
from app.schemas.analyses import AnalysisCreate


class AnalysesService:
    """Creates, lists, updates and deletes analyses for the current user."""

    def create(self, db: Session, user_id: int, payload: AnalysisCreate) -> Analysis:
        """Persist a new analysis owned by the authenticated user."""
        analysis = Analysis(
            user_id=user_id,
            name=payload.name,
            date=payload.date,
            value=payload.value,
            ref_upper=payload.ref_upper,
            ref_lower=payload.ref_lower,
            organization=payload.organization,
            note=payload.note,
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return analysis

    def list_for_user(self, db: Session, user_id: int) -> list[Analysis]:
        """Return all analyses of a user ordered by date and name."""
        return (
            db.query(Analysis)
            .filter(Analysis.user_id == user_id)
            .order_by(asc(Analysis.date), asc(Analysis.name), asc(Analysis.id))
            .all()
        )

    def _get_owned(self, db: Session, user_id: int, analysis_id: int) -> Analysis:
        """Load an analysis owned by the user or raise 404."""
        analysis = (
            db.query(Analysis)
            .filter(Analysis.id == analysis_id, Analysis.user_id == user_id)
            .first()
        )
        if not analysis:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
        return analysis

    def update(self, db: Session, user_id: int, analysis_id: int, payload: AnalysisCreate) -> Analysis:
        """Update an existing analysis belonging to the user."""
        analysis = self._get_owned(db, user_id, analysis_id)
        analysis.name = payload.name
        analysis.date = payload.date
        analysis.value = payload.value
        analysis.ref_upper = payload.ref_upper
        analysis.ref_lower = payload.ref_lower
        analysis.organization = payload.organization
        analysis.note = payload.note
        db.commit()
        db.refresh(analysis)
        return analysis

    def delete(self, db: Session, user_id: int, analysis_id: int) -> None:
        """Delete an analysis if it belongs to the user, otherwise 404."""
        analysis = self._get_owned(db, user_id, analysis_id)
        db.delete(analysis)
        db.commit()
