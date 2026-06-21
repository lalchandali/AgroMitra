# ============================================================
#   AgroMitra — Order Schemas (Pydantic)
# ============================================================

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from backend.database.models.order import OrderStatus, PaymentStatus, PaymentMethod, DeliveryType


# ── Place Order ───────────────────────────────────────────────
class OrderCreate(BaseModel):
    product_id      : UUID
    quantity_kg     : float         = Field(..., gt=0, example=50.0)
    payment_method  : PaymentMethod = Field(..., example="bkash")
    delivery_type   : DeliveryType  = Field(..., example="pickup")
    delivery_address: Optional[str] = Field(None, example="House 12, Road 5, Dhaka")


# ── Update Order Status ───────────────────────────────────────
class OrderStatusUpdate(BaseModel):
    status: OrderStatus = Field(..., example="confirmed")


# ── Order Response ────────────────────────────────────────────
class OrderResponse(BaseModel):
    order_id        : UUID
    buyer_id        : UUID
    farmer_id       : UUID
    product_id      : UUID
    quantity_kg     : float
    unit_price      : float
    total_amount    : float
    platform_fee    : float
    farmer_amount   : float
    status          : OrderStatus
    payment_status  : PaymentStatus
    payment_method  : PaymentMethod
    delivery_type   : DeliveryType
    delivery_address: Optional[str]
    created_at      : datetime
    confirmed_at    : Optional[datetime]
    delivered_at    : Optional[datetime]

    class Config:
        from_attributes = True
