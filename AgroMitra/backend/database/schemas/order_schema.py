# ============================================================
#   AgroMitra — Order Schemas (Pydantic)
#   একটা Order-এ এখন একাধিক OrderItem (product line) থাকতে পারে।
# ============================================================

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, root_validator

from backend.database.models.order import DeliveryType, OrderStatus, PaymentMethod, PaymentStatus


# ── Place Order ───────────────────────────────────────────────
class OrderItemCreate(BaseModel):
    product_id: UUID
    quantity: Optional[Decimal] = Field(None, gt=0, max_digits=10, decimal_places=2)
    quantity_kg: Optional[Decimal] = Field(None, gt=0, max_digits=10, decimal_places=2, example=50.0)

    @root_validator(skip_on_failure=True)
    def require_quantity(cls, values):
        if values.get("quantity") is None and values.get("quantity_kg") is None:
            raise ValueError("An order quantity is required.")
        return values


class OrderCreate(BaseModel):
    # সব item একই farmer-এর হতে হবে — এক Order = এক farmer-এর একটা checkout।
    # আলাদা farmer-এর product থাকলে frontend প্রতি farmer-এর জন্য আলাদা
    # OrderCreate পাঠাবে (cart-কে farmer অনুযায়ী group করে)।
    items: List[OrderItemCreate] = Field(..., min_length=1)
    payment_method: PaymentMethod = Field(
        default=PaymentMethod.cash_on_delivery,
        example="cash_on_delivery",
    )
    delivery_method: DeliveryType = Field(default=DeliveryType.pickup, example="pickup")
    delivery_type: Optional[DeliveryType] = None
    delivery_address: Optional[str] = Field(
        None, example="House 12, Road 5, Dhaka")
    delivery_note: Optional[str] = Field(None, max_length=1000)

    @root_validator(pre=True)
    def accept_legacy_delivery_type(cls, values):
        if isinstance(values, dict) and "delivery_method" not in values and "delivery_type" in values:
            values = {**values, "delivery_method": values["delivery_type"]}
        return values


# ── Update Order Status ───────────────────────────────────────
class OrderStatusUpdate(BaseModel):
    status: OrderStatus = Field(..., example="confirmed")


# ── Order Item Response ─────────────────────────────────────
class OrderItemResponse(BaseModel):
    order_item_id: UUID
    product_id: UUID
    quantity_kg: float
    quantity: float
    unit: str = "kg"
    unit_price: float
    subtotal: float
    product_name: Optional[str] = None
    product_name_bn: Optional[str] = None
    product_image_url: Optional[str] = None

    class Config:
        from_attributes = True


# ── Order Response ────────────────────────────────────────────
class OrderResponse(BaseModel):
    order_id: UUID
    buyer_id: UUID
    farmer_id: UUID
    total_amount: float
    platform_fee: float
    farmer_amount: float
    status: OrderStatus
    payment_status: PaymentStatus
    payment_method: PaymentMethod
    delivery_method: DeliveryType
    delivery_type: DeliveryType
    delivery_address: Optional[str]
    delivery_note: Optional[str] = None
    created_at: datetime
    confirmed_at: Optional[datetime]
    delivered_at: Optional[datetime]
    buyer_name: Optional[str] = None
    farmer_name: Optional[str] = None
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True
