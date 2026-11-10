import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from backend.database.database import Base


class ReportStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


class ReportTargetType(str, enum.Enum):
    listing = "listing"
    user = "user"


class UserReport(Base):
    __tablename__ = "user_reports"
    __table_args__ = (
        CheckConstraint(
            "(target_type = 'listing' AND target_user_id IS NULL) "
            "OR (target_type = 'user' AND target_product_id IS NULL)",
            name="ck_user_report_single_target",
        ),
        {"extend_existing": True},
    )

    report_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    target_type = Column(String(16), nullable=False)
    target_product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.product_id", ondelete="SET NULL"), nullable=True
    )
    target_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )
    reason = Column(Text, nullable=False)
    status = Column(
        String(16),
        nullable=False,
        default=ReportStatus.open.value,
        server_default=ReportStatus.open.value,
    )
    admin_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
