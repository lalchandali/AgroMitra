from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database.models.order import Order, OrderStatus
from backend.database.models.review import Review
from backend.database.models.user import User, UserRole


def calculate_trust_score(
    verification_status,
    average_rating,
    review_count: int,
    delivered_order_count: int,
) -> float:
    """Combine verification (30%), buyer ratings (40%), and deliveries (30%).

    Farmers without reviews or completed orders receive neutral component scores.
    Delivery experience adds five points per completed order, capped at ten orders.
    """
    status = getattr(verification_status, "value", verification_status)
    verification_score = {
        "approved": 100,
        "pending": 50,
        "rejected": 0,
    }.get(status, 50)

    rating_score = (
        min(100, max(0, float(average_rating) * 20))
        if average_rating is not None and review_count > 0
        else 50
    )
    order_score = 50 + 5 * min(max(delivered_order_count, 0), 10)

    return round(
        verification_score * 0.30
        + rating_score * 0.40
        + order_score * 0.30,
        1,
    )


def refresh_trust_score(user: User, db: Session) -> tuple[float, bool]:
    if user.role != UserRole.farmer:
        return float(user.trust_score or 50), False

    average_rating, review_count = db.query(
        func.avg(Review.rating),
        func.count(Review.review_id),
    ).filter(Review.farmer_id == user.user_id).one()
    delivered_order_count = db.query(func.count(Order.order_id)).filter(
        Order.farmer_id == user.user_id,
        Order.status == OrderStatus.delivered,
    ).scalar() or 0

    score = calculate_trust_score(
        user.verification_status,
        average_rating,
        review_count,
        delivered_order_count,
    )
    current_score = float(user.trust_score) if user.trust_score is not None else None
    if current_score != score:
        user.trust_score = score
        return score, True
    return score, False
