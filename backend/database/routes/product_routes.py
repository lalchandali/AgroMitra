# ============================================================
#   AgroMitra — Product Listing Routes
#   Create, Read, Update, Delete product listings
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore[import]
from sqlalchemy.orm import Session  # type: ignore[import]
from typing import Optional, List
from uuid import UUID

from backend.database.database import get_db
from backend.database.models.product import Product, ProductStatus
from backend.database.models.user import User, UserRole
from backend.database.schemas.product_schema import ProductCreate, ProductUpdate, ProductResponse
from backend.database.routes.auth_routes import get_current_user

router = APIRouter(prefix="/api/v1/products", tags=["Products"])


# ── POST /api/v1/products ─────────────────────────────────────
@router.post("/", response_model=ProductResponse)
async def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Farmer নতুন product listing তৈরি করো।"""
    if current_user.role not in [UserRole.farmer, UserRole.admin]:
        raise HTTPException(status_code=403, detail="Only farmers can create listings.")

    new_product = Product(
        farmer_id      = current_user.user_id,
        title_en       = product_data.title_en,
        title_bn       = product_data.title_bn,
        category       = product_data.category,
        description_en = product_data.description_en,
        quantity_kg    = product_data.quantity_kg,
        unit_price_bdt = product_data.unit_price_bdt,
        quality_grade  = product_data.quality_grade,
        district       = product_data.district,
        is_organic     = product_data.is_organic,
        harvest_date   = product_data.harvest_date,
        availability_until = product_data.availability_until,
        # AI fair price — simple calculation
        ai_fair_price_min = round(float(product_data.unit_price_bdt) * 0.90, 2),
        ai_fair_price_max = round(float(product_data.unit_price_bdt) * 1.10, 2),
    )

    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product


# ── GET /api/v1/products ──────────────────────────────────────
@router.get("/", response_model=List[ProductResponse])
async def get_products(
    category  : Optional[str]  = Query(None, example="Vegetable"),
    district  : Optional[str]  = Query(None, example="Bogura"),
    is_organic: Optional[bool] = Query(None),
    min_price : Optional[float]= Query(None),
    max_price : Optional[float]= Query(None),
    skip      : int            = Query(0, ge=0),
    limit     : int            = Query(20, ge=1, le=100),
    db        : Session        = Depends(get_db)
):
    """সব active product listings দেখাও। Filter করা যাবে।"""
    query = db.query(Product).filter(Product.status == ProductStatus.active)

    if category:   query = query.filter(Product.category == category)
    if district:   query = query.filter(Product.district == district)
    if is_organic is not None: query = query.filter(Product.is_organic == is_organic)
    if min_price:  query = query.filter(Product.unit_price_bdt >= min_price)
    if max_price:  query = query.filter(Product.unit_price_bdt <= max_price)

    products = query.order_by(Product.created_at.desc()).offset(skip).limit(limit).all()
    return products


# ── GET /api/v1/products/my ───────────────────────────────────
@router.get("/my", response_model=List[ProductResponse])
async def get_my_products(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Farmer-এর নিজের সব listings দেখাও।"""
    products = db.query(Product).filter(
        Product.farmer_id == current_user.user_id
    ).order_by(Product.created_at.desc()).all()
    return products


# ── GET /api/v1/products/{product_id} ────────────────────────
@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    db: Session = Depends(get_db)
):
    """একটি product-এর details দেখাও।"""
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    # View count বাড়াও
    product.views_count += 1
    db.commit()
    db.refresh(product)
    return product


# ── PUT /api/v1/products/{product_id} ────────────────────────
@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id  : UUID,
    update_data : ProductUpdate,
    current_user: User = Depends(get_current_user),
    db          : Session = Depends(get_db)
):
    """Product listing update করো (শুধু owner করতে পারবে)।"""
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    if str(product.farmer_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="You can only edit your own listings.")

    if update_data.title_en       is not None: product.title_en       = update_data.title_en
    if update_data.title_bn       is not None: product.title_bn       = update_data.title_bn
    if update_data.description_en is not None: product.description_en = update_data.description_en
    if update_data.quantity_kg    is not None: product.quantity_kg    = update_data.quantity_kg
    if update_data.unit_price_bdt is not None:
        product.unit_price_bdt    = update_data.unit_price_bdt
        product.ai_fair_price_min = round(float(update_data.unit_price_bdt) * 0.90, 2)
        product.ai_fair_price_max = round(float(update_data.unit_price_bdt) * 1.10, 2)
    if update_data.quality_grade  is not None: product.quality_grade  = update_data.quality_grade
    if update_data.is_organic     is not None: product.is_organic     = update_data.is_organic
    if update_data.status         is not None: product.status         = update_data.status
    if update_data.availability_until is not None: product.availability_until = update_data.availability_until

    db.commit()
    db.refresh(product)
    return product


# ── DELETE /api/v1/products/{product_id} ─────────────────────
@router.delete("/{product_id}")
async def delete_product(
    product_id  : UUID,
    current_user: User = Depends(get_current_user),
    db          : Session = Depends(get_db)
):
    """Product listing remove করো।"""
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    if str(product.farmer_id) != str(current_user.user_id) and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="You can only delete your own listings.")

    product.status = ProductStatus.removed
    db.commit()
    return {"message": "Product removed successfully.", "product_id": str(product_id)}
