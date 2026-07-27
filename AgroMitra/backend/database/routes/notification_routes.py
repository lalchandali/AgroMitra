# ============================================================
#   AgroMitra — Notification Routes
#   Users only read/mark-as-read their own notifications.
#   Notifications themselves are created server-side (see
#   create_notification() below) — e.g. by order_routes.py when
#   an order is placed, or review_routes.py when a review lands.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from backend.database import get_db
from backend.database.models.notification import Notification
from backend.database.models.user import User
from backend.database.schemas.notification_schema import NotificationResponse, UnreadCountResponse
from backend.database.routes.auth_routes import get_current_user

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


# ── Helper: অন্য router (orders, reviews, ...) থেকে কল করে notification বানানো হয় ──
def create_notification(
    db: Session,
    user_id,
    type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
) -> Notification:
    """
    নতুন notification তৈরি করে DB session-এ add করে (commit করে না —
    caller-এর নিজের commit-এর সাথেই এটা একই transaction-এ যাবে, যাতে
    order/review commit হলে notification-ও নিশ্চিতভাবে সাথে সেভ হয়)।
    """
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notification)
    return notification


# ── GET /api/v1/notifications ─────────────────────────────────
@router.get("/", response_model=List[NotificationResponse])
async def get_my_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """বর্তমান user-এর notifications, সবচেয়ে নতুনটা সবার আগে।"""
    query = db.query(Notification).filter(Notification.user_id == current_user.user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return notifications


# ── GET /api/v1/notifications/unread-count ────────────────────
@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Notification bell-এর badge count — polling করে ব্যবহার করা যায়।"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False,  # noqa: E712
    ).count()
    return UnreadCountResponse(unread_count=count)


# ── PUT /api/v1/notifications/{notification_id}/read ──────────
@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """একটা notification read হিসেবে mark করো (নিজের notification ছাড়া পারবে না)।"""
    notification = db.query(Notification).filter(
        Notification.notification_id == notification_id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if str(notification.user_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="Access denied.")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


# ── PUT /api/v1/notifications/read-all ─────────────────────────
@router.put("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """বর্তমান user-এর সব unread notification একসাথে read করো।"""
    updated = db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read.", "updated_count": updated}
