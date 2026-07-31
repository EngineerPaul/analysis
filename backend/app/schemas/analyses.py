"""Pydantic schemas for analysis entities."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.utils.validators import ANALYSIS_NAME_PATTERN, ORGANIZATION_PATTERN


class AnalysisCreate(BaseModel):
    """Payload for creating an analysis."""

    name: str = Field(min_length=1, max_length=60)
    date: date
    value: Decimal
    ref_upper: Decimal | None = None
    ref_lower: Decimal | None = None
    organization: str | None = Field(default=None, max_length=30)
    note: str | None = Field(default=None, max_length=1500)

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str) -> str:
        if not ANALYSIS_NAME_PATTERN.fullmatch(value):
            raise ValueError("Analysis name may contain letters, digits and spaces only")
        return value

    @field_validator("organization")
    @classmethod
    def check_organization(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not ORGANIZATION_PATTERN.fullmatch(value):
            raise ValueError("Organization contains invalid characters")
        return value

    @model_validator(mode="after")
    def check_references(self) -> "AnalysisCreate":
        upper = self.ref_upper
        lower = self.ref_lower
        if (upper is None) ^ (lower is None):
            raise ValueError("Both reference values must be provided together or both omitted")
        if upper is not None and lower is not None and upper <= lower:
            raise ValueError("Upper reference must be greater than lower reference")
        return self


class AnalysisResponse(BaseModel):
    """Analysis representation returned by the API."""

    id: int
    name: str
    date: date
    value: Decimal
    ref_upper: Decimal | None
    ref_lower: Decimal | None
    organization: str | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
