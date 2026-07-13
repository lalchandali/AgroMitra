# ============================================================
#   AgroMitra — Review Routes
#   Buyer শুধু delivered order-এর কেনা product-এ review দিতে
#   পারবে, প্রতি order item-এ একবারই।
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from backend.database import get_db
from backend.database.models.review import Review
from backend.database.models.order import Order, OrderStatus
from backend.database.models.order_item import OrderItem
from backend.database.models.product import Product
from backend.database.models.user import User
from backend.database.schemas.review_schema import ReviewCreate, ReviewResponse
from backend.database.routes.auth_routes import get_current_user

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
    if not order or str(order.buyer_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="You can only review products from your own orders.")

    if order.status != OrderStatus.delivered:
        raise HTTPException(status_code=400, detail="You can only review products after delivery is confirmed.")

    existing = db.query(Review).filter(Review.order_item_id == payload.order_item_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="You've already reviewed this item.")

    review = Review(
        order_item_id=order_item.order_item_id,
        product_id=order_item.product_id,
        farmer_id=order.farmer_id,
        buyer_id=current_user.user_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.commit()
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
    delivered_order_ids = [
        row.order_id for row in db.query(Order.order_id).filter(
            Order.buyer_id == current_user.user_id,
            Order.status == OrderStatus.delivered
        ).all()
    ]
    if not delivered_order_ids:
        return []

    all_item_ids = {
        row.order_item_id for row in db.query(OrderItem.order_item_id).filter(
            OrderItem.order_id.in_(delivered_order_ids)
        ).all()
    }

    reviewed_item_ids = {
        row.order_item_id for row in db.query(Review.order_item_id).filter(
            Review.buyer_id == current_user.user_id
        ).all()
    }

    return list(all_item_ids - reviewed_item_ids)
