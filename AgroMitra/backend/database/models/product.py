# ============================================================
#   AgroMitra — Product Model
#   Represents farmer product listings
# ============================================================

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from backend.database.database import Base
from backend.database.utils.quantity_units import quantity_from_base


class QualityGrade(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"


class ProductStatus(str, enum.Enum):
    active   = "active"
    sold_out = "sold_out"
    expired  = "expired"
    removed  = "removed"


class StockStatus(str, enum.Enum):
    in_stock = "in_stock"
    low_stock = "low_stock"
    out_of_stock = "out_of_stock"


class Product(Base):
    __tablename__ = "products"
    __table_args__ = {'extend_existing': True}

    product_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    farmer_id      = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)

    title_en       = Column(String(150), nullable=False)
    title_bn       = Column(String(200), nullable=True)
    category       = Column(String(50), nullable=False)     # Vegetable, Fruit, Grain, Spice
    description_en = Column(Text, nullable=True)

    # Legacy column stores normalized stock: kg for kg/maund, pieces for dozen/piece.
    quantity_kg    = Column(Numeric(10, 2), nullable=False)
    sale_unit      = Column(String(16), nullable=False, default="kg", server_default="kg")
    low_stock_threshold_kg = Column(Numeric(10, 2), nullable=False, default=5.0, server_default="5.00")
    # Price is always per sale_unit; existing kg listings retain their prior meaning.
    unit_price_bdt = Column(Numeric(10, 2), nullable=False)
    quality_grade  = Column(Enum(QualityGrade), default=QualityGrade.A)

    photos         = Column(ARRAY(String), nullable=True)   # S3 URLs array
    district       = Column(String(50), nullable=False)

    harvest_date       = Column(DateTime, nullable=True)
    availability_until = Column(DateTime, nullable=True)
    is_organic         = Column(Boolean, default=False)

    ai_fair_price_min = Column(Numeric(10, 2), nullable=True)
    ai_fair_price_max = Column(Numeric(10, 2), nullable=True)

    status      = Column(Enum(ProductStatus), default=ProductStatus.active)
    views_count = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return (
            f"<Product {self.title_en} - {self.quantity} {self.sale_unit} "
            f"@ ৳{self.unit_price_bdt}/{self.sale_unit}>"
        )

    @property
    def image_url(self):
        """
        photos array-এর প্রথম ছবিটাকে "main image" হিসেবে ব্যবহার করা হয়।
        Frontend আপাতত একটাই ছবি আপলোড করে, তাই এই singular property-টা
        ProductResponse-এ সরাসরি ব্যবহার হয় (SQLAlchemy attribute হিসেবেই
        দেখা যায়, তাই Pydantic-এর from_attributes সাথে সাথে কাজ করে)।
        """
        return self.photos[0] if self.photos else None

    @property
    def quantity(self):
        return float(quantity_from_base(self.quantity_kg or 0, self.sale_unit or "kg"))

    @property
    def stock_status(self):
        quantity = float(self.quantity_kg or 0)
        if self.status != ProductStatus.active or quantity <= 0:
            return StockStatus.out_of_stock
        if quantity <= float(self.low_stock_threshold_kg or 0):
            return StockStatus.low_stock
        return StockStatus.in_stock
