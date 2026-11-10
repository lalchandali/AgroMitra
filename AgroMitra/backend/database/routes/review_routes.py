# ============================================================
#   AgroMitra — Review Routes
#   Buyer শুধু delivered order-এর কেনা product-এ review দিতে
#   পারবে, প্রতি order item-এ একবারই।
# ============================================================

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.database.models.order import Order, OrderStatus
from backend.database.models.order_item import OrderItem
from backend.database.models.product import Product
from backend.database.models.review import Review
from backend.database.models.review_product_claim import ReviewProductClaim
from backend.database.models.user import User, UserRole
from backend.database.routes.auth_routes import get_current_user
from backend.database.routes.notification_routes import create_notification
from backend.database.schemas.review_schema import ReviewCreate, ReviewResponse
from backend.database.utils.review_eligibility import review_eligibility_error

router = APIRouter(prefix="/api/v1/reviews", tags=["Reviews"])


def _build_review_response(review: Review, db: Session) -> ReviewResponse:
    buyer = db.query(User).filter(User.user_id == review.buyer_id).first()
    product = db.query(Product).filter(Product.product_id == review.product_id).first()
    return ReviewResponse(
        review_id=review.review_id,
        order_item_id=review.order_item_id,
        product_id=review.product_id,
        farmer_id=review.farmer_id,
        buyer_id=review.buyer_id,
        buyer_name=buyer.name_en if buyer else None,
        product_name=product.title_en if product else None,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )


# ── POST /api/v1/reviews ──────────────────────────────────────
@router.post("/", response_model=ReviewResponse)
async def create_review(
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Buyer একটা কেনা product-এ review দেয় — শুধু delivered order-এর item-এর জন্য, প্রতি item-এ একবারই।"""
    order_item = db.query(OrderItem).filter(OrderItem.order_item_id == payload.order_item_id).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found.")

    order = db.query(Order).filter(Order.order_id == order_item.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    existing = db.query(Review).filter(
        Review.buyer_id == current_user.user_id,
        Review.product_id == order_item.product_id,
    ).first()
    eligibility_error = review_eligibility_error(
        is_buyer=current_user.role in (UserRole.buyer, UserRole.consumer),
        owns_order=str(order.buyer_id) == str(current_user.user_id),
        delivered=order.status == OrderStatus.delivered,
        already_reviewed=existing is not None,
    )
    if eligibility_error:
        status_code, detail = eligibility_error
        raise HTTPException(status_code=status_code, detail=detail)

    db.add(ReviewProductClaim(
        buyer_id=current_user.user_id,
        product_id=order_item.product_id,
    ))
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        if constraint_name == "review_product_claims_pkey":
            raise HTTPException(status_code=409, detail="You have already reviewed this product.") from error
        raise

    review = Review(
        order_item_id=order_item.order_item_id,
        product_id=order_item.product_id,
        farmer_id=order.farmer_id,
        buyer_id=current_user.user_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)

    product = db.query(Product).filter(Product.product_id == order_item.product_id).first()
    stars = "⭐" * payload.rating
    create_notification(
        db,
        user_id=order.farmer_id,
        type="new_review",
        title=f"{stars} New review received",
        message=f"{current_user.name_en} rated {product.title_en if product else 'your product'} {payload.rating}/5.",
        link="/farmer?tab=listings",
    )

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        if constraint_name in {"uq_review_per_order_item", "review_product_claims_pkey"}:
            raise HTTPException(status_code=409, detail="You have already reviewed this product.") from error
        raise
    db.refresh(review)
    return _build_review_response(review, db)


# ── GET /api/v1/reviews/product/{product_id} ──────────────────
@router.get("/product/{product_id}", response_model=List[ReviewResponse])
async def get_product_reviews(product_id: UUID, db: Session = Depends(get_db)):
    """একটা product-এর সব review (public — buyer/farmer কেউ login না করেও দেখতে পারবে)।"""
    reviews = db.query(Review).filter(Review.product_id == product_id) \
        .order_by(Review.created_at.desc()).all()
    return [_build_review_response(r, db) for r in reviews]


# ── GET /api/v1/reviews/farmer/{farmer_id} ─────────────────────
@router.get("/farmer/{farmer_id}", response_model=List[ReviewResponse])
async def get_farmer_reviews(farmer_id: UUID, db: Session = Depends(get_db)):
    """একজন farmer-এর সব product মিলিয়ে সব review (public)।"""
    reviews = db.query(Review).filter(Review.farmer_id == farmer_id) \
        .order_by(Review.created_at.desc()).all()
    return [_build_review_response(r, db) for r in reviews]


# ── GET /api/v1/reviews/my ─────────────────────────────────────
@router.get("/my", response_model=List[ReviewResponse])
async def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Buyer নিজে যেসব review দিয়েছে তার তালিকা।"""
    reviews = db.query(Review).filter(Review.buyer_id == current_user.user_id) \
        .order_by(Review.created_at.desc()).all()
    return [_build_review_response(r, db) for r in reviews]


# ── GET /api/v1/reviews/reviewable-items ───────────────────────
@router.get("/reviewable-items", response_model=List[UUID])
async def get_reviewable_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    বর্তমান buyer-এর delivered order-এর যেসব item এখনো review করা
    হয়নি, তাদের order_item_id — frontend এটা দিয়ে বুঝবে My Orders-এ
    কোন item-এর পাশে "⭐ Rate this" বাটন দেখাতে হবে।
    """
    if current_user.role not in (UserRole.buyer, UserRole.consumer):
        return []

    delivered_order_ids = [
        row.order_id for row in db.query(Order.order_id).filter(
            Order.buyer_id == current_user.user_id,
            Order.status == OrderStatus.delivered
        ).all()
    ]
    if not delivered_order_ids:
        return []

    claimed_product_ids = {
        row.product_id for row in db.query(ReviewProductClaim.product_id).filter(
            ReviewProductClaim.buyer_id == current_user.user_id
        ).all()
    }

    reviewable_item_ids = []
    seen_product_ids = set(claimed_product_ids)
    for item in db.query(OrderItem).filter(OrderItem.order_id.in_(delivered_order_ids)).all():
        if item.product_id not in seen_product_ids:
            reviewable_item_ids.append(item.order_item_id)
            seen_product_ids.add(item.product_id)
    return reviewable_item_ids
