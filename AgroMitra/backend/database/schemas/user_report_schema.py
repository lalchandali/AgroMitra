from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from backend.database.models.user_report import ReportStatus, ReportTargetType


class UserReportCreate(BaseModel):
    target_type: ReportTargetType
    target_product_id: Optional[UUID] = None
    target_user_id: Optional[UUID] = None
    reason: str = Field(..., min_length=5, max_length=2000)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value):
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Report reason must contain at least 5 non-whitespace characters.")
        return value


class UserReportUpdate(BaseModel):
    status: ReportStatus
    admin_note: Optional[str] = Field(None, max_length=2000)


class UserReportResponse(BaseModel):
    report_id: UUID
    reporter_id: UUID
    reporter_name: Optional[str]
    target_type: ReportTargetType
    target_product_id: Optional[UUID]
    target_product_name: Optional[str]
    target_user_id: Optional[UUID]
    target_user_name: Optional[str]
    reason: str
    status: ReportStatus
    admin_note: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True
