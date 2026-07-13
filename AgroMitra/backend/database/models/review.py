# ============================================================
#   AgroMitra — Review Model
#   একজন buyer শুধু তার নিজের delivered order-এর প্রতিটা item-এর
#   জন্য একবারই review দিতে পারবে (order_item_id-এর উপর UNIQUE)।
# ============================================================

import uuid
from backend.database.database import Base
from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("order_item_id", name="uq_review_per_order_item"),
        {'extend_existing': True}
    )

    review_id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_item_id  = Column(UUID(as_uuid=True), ForeignKey("order_items.order_item_id"), nullable=False)
    product_id     = Column(UUID(as_uuid=True), ForeignKey("products.product_id"), nullable=False)
    farmer_id      = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    buyer_id       = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)

    rating  = Column(Integer, nullable=False)   # 1–5
    comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Review {self.review_id} - {self.rating}★>"
