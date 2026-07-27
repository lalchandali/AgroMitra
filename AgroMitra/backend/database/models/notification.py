# ============================================================
#   AgroMitra — Notification Model
#   In-app notifications for a user: new order, order status
#   change, new review, etc. Created server-side only — users
#   never POST a notification directly, only read/mark-as-read.
# ============================================================

import uuid
from backend.database.database import Base
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {'extend_existing': True}

    notification_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False, index=True)

    # e.g. "order_placed", "order_status", "order_cancelled", "new_review"
    type    = Column(String(50), nullable=False)
    title   = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    # frontend route to open when the notification is clicked, e.g. "/orders/<id>"
    link = Column(String(300), nullable=True)

    is_read    = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f"<Notification {self.type} -> {self.user_id} read={self.is_read}>"
