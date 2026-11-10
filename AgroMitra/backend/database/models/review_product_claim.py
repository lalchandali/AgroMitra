from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from backend.database.database import Base


class ReviewProductClaim(Base):
    __tablename__ = "review_product_claims"
    __table_args__ = {"extend_existing": True}

    buyer_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), primary_key=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.product_id"), primary_key=True)
