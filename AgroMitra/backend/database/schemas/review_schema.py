# ============================================================
#   AgroMitra — Review Schemas (Pydantic)
# ============================================================

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class ReviewCreate(BaseModel):
    order_item_id: UUID
    rating: int = Field(..., ge=1, le=5, example=5)
    comment: Optional[str] = Field(None, max_length=1000, example="খুব ভালো মানের পণ্য, সময়মতো পেয়েছি।")


class ReviewResponse(BaseModel):
    review_id: UUID
    order_item_id: UUID
    product_id: UUID
    farmer_id: UUID
    buyer_id: UUID
    buyer_name: Optional[str] = None
    product_name: Optional[str] = None
    rating: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
