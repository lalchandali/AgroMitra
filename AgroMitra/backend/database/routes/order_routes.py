# ============================================================
#   AgroMitra — Order Management Routes
#   Place, Track, Update, Cancel orders
#   একটা Order-এ একাধিক product (OrderItem) থাকতে পারে —
#   একই farmer থেকে কেনা সব product এক Order-এ group হয়ে যায়।
# ============================================================

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case
from sqlalchemy.orm import Session

# Windows console UTF-8 fix এখন main.py-এর একদম শুরুতে একবারই করা হয়
# (sys.stdout.reconfigure) — তাই এখানে আলাদা করে stdout wrap করার
# দরকার নেই।
from backend.database import get_db
from backend.database.models.order import DeliveryType, Order, OrderStatus, PaymentMethod, PaymentStatus
from backend.database.models.order_item import OrderItem
from backend.database.models.product import Product, ProductStatus
from backend.database.models.user import User, UserRole
from backend.database.routes.auth_routes import get_current_user
from backend.database.routes.notification_routes import create_notification
from backend.database.routes.settings_routes import get_platform_fee_percent
from backend.database.schemas.order_schema import (
    OrderCreate,
    OrderItemResponse,
    OrderResponse,
    OrderStatusUpdate,
)
from backend.database.utils.order_finance import calculate_order_totals
from backend.database.utils.quantity_units import calculate_sale_line, quantity_from_base

router = APIRouter(prefix="/api/v1/orders", tags=["Orders"])


# ── Helper: Order + তার সব items + product/user নাম জুড়ে একটা OrderResponse বানাও ──
def _build_order_response(order: Order, db: Session) -> OrderResponse:
    items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).all()

    product_ids = [i.product_id for i in items]
    products = {}
    if product_ids:
        rows = db.query(Product).filter(Product.product_id.in_(product_ids)).all()
        products = {p.product_id: p for p in rows}

    item_responses = []
    for i in items:
        p = products.get(i.product_id)
        item_responses.append(OrderItemResponse(
            order_item_id=i.order_item_id,
            product_id=i.product_id,
            quantity_kg=float(i.quantity_kg),
            quantity=float(i.quantity if i.quantity is not None else quantity_from_base(i.quantity_kg, i.unit or "kg")),
            unit=i.unit or "kg",
            unit_price=float(i.unit_price),
            subtotal=float(i.subtotal),
            product_name=p.title_en if p else None,
            product_name_bn=p.title_bn if p else None,
            product_image_url=p.image_url if p else None,
        ))

    buyer = db.query(User).filter(User.user_id == order.buyer_id).first()
    farmer = db.query(User).filter(User.user_id == order.farmer_id).first()

    return OrderResponse(
        order_id=order.order_id,
        buyer_id=order.buyer_id,
        farmer_id=order.farmer_id,
        total_amount=float(order.total_amount),
        platform_fee=float(order.platform_fee),
        farmer_amount=float(order.farmer_amount),
        status=order.status,
        payment_status=order.payment_status,
        payment_method=order.payment_method,
        delivery_method=order.delivery_method,
        delivery_type=order.delivery_method,
        delivery_address=order.delivery_address,
        delivery_note=order.delivery_note,
        created_at=order.created_at,
        confirmed_at=order.confirmed_at,
        delivered_at=order.delivered_at,
        buyer_name=buyer.name_en if buyer else None,
        farmer_name=farmer.name_en if farmer else None,
        items=item_responses,
    )


# ── Helper: order cancel/reject হলে সব item-এর stock ফেরত দাও ──
def _restock_order_items(order: Order, db: Session):
    items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).all()
    for item in items:
        db.query(Product).filter(
            Product.product_id == item.product_id
        ).update(
            {
                "quantity_kg": Product.quantity_kg + item.quantity_kg,
                "status": case(
                    (Product.status == ProductStatus.sold_out, ProductStatus.active),
                    else_=Product.status,
                ),
            },
            synchronize_session=False,
        )


# ── POST /api/v1/orders ───────────────────────────────────────
@router.post("/", response_model=OrderResponse)
async def place_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Buyer নতুন order place করো — একাধিক product একসাথে (একই farmer-এর হতে হবে)।
    Frontend cart-কে farmer অনুযায়ী group করে, প্রতি farmer-এর জন্য এই
    endpoint আলাদাভাবে কল করে।
    """
    if not order_data.items:
        raise HTTPException(status_code=400, detail="Cart is empty.")

    # ডুপ্লিকেট product_id ঠেকাও (একই product দুইবার লাইনে থাকলে গুলিয়ে যাবে)
    seen_ids = set()
    for item in order_data.items:
        if item.product_id in seen_ids:
            raise HTTPException(
                status_code=400,
                detail="Duplicate product in the same order — combine the quantity into one line."
            )
        seen_ids.add(item.product_id)

    product_ids = [item.product_id for item in order_data.items]
    products = db.query(Product).filter(
        Product.product_id.in_(product_ids),
        Product.status == ProductStatus.active
    ).all()
    product_map = {p.product_id: p for p in products}

    missing = [str(i.product_id) for i in order_data.items if i.product_id not in product_map]
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Product(s) not found or unavailable: {', '.join(missing)}"
        )

    # সব item একই farmer-এর কিনা check করো — এক Order = এক farmer
    farmer_ids = {product_map[i.product_id].farmer_id for i in order_data.items}
    if len(farmer_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="All items in one order must be from the same farmer. Place separate orders for different farmers."
        )
    farmer_id = farmer_ids.pop()

    if str(farmer_id) == str(current_user.user_id):
        raise HTTPException(status_code=400, detail="You cannot order your own product.")

    if order_data.delivery_method == DeliveryType.delivery and not order_data.delivery_address:
        raise HTTPException(status_code=400, detail="Delivery address required for delivery orders.")

    # প্রতিটা item-এর জন্য stock atomically check + decrement করো
    # (WHERE quantity_kg >= চাহিদা — দুইজন একসাথে অর্ডার করলেও overselling হবে না)
    order_items_data = []  # (product, sale quantity, base quantity, unit, unit price, subtotal)
    items_subtotal = Decimal("0.00")
    try:
        for item in order_data.items:
            product = product_map[item.product_id]
            sale_unit = product.sale_unit or "kg"
            requested_quantity = item.quantity
            if requested_quantity is None:
                if sale_unit != "kg":
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "This product requires a quantity in its listed unit. "
                            "Refresh the marketplace and try again."
                        ),
                    )
                requested_quantity = item.quantity_kg
            try:
                sale_quantity, base_quantity, subtotal = calculate_sale_line(
                    requested_quantity,
                    sale_unit,
                    product.unit_price_bdt,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            if base_quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Order quantities must be at least 0.01 in the listed unit.",
                )
            unit_price = Decimal(str(product.unit_price_bdt))
            items_subtotal += subtotal

            updated_rows = db.query(Product).filter(
                Product.product_id == item.product_id,
                Product.status == ProductStatus.active,
                Product.quantity_kg >= base_quantity
            ).update(
                {"quantity_kg": Product.quantity_kg - base_quantity},
                synchronize_session=False,
            )

            if updated_rows == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Stock changed while placing the order. Refresh the product and try again."
                )
            order_items_data.append((product, sale_quantity, base_quantity, sale_unit, unit_price, subtotal))
    except HTTPException:
        db.rollback()
        raise

    platform_fee_percent = get_platform_fee_percent(db)  # admin panel থেকে সেট করা %
    total_amount, platform_fee, farmer_amount = calculate_order_totals(
        items_subtotal,
        platform_fee_percent,
    )

    new_order = Order(
        buyer_id=current_user.user_id,
        farmer_id=farmer_id,
        total_amount=total_amount,
        platform_fee=platform_fee,
        farmer_amount=farmer_amount,
        payment_method=order_data.payment_method,
        delivery_method=order_data.delivery_method,
        delivery_address=order_data.delivery_address,
        delivery_note=order_data.delivery_note,
        status=OrderStatus.placed,
        payment_status=(
            PaymentStatus.paid
            if order_data.payment_method in {PaymentMethod.mock_bkash, PaymentMethod.mock_nagad}
            else PaymentStatus.pending
        ),
    )
    db.add(new_order)
    db.flush()  # commit ছাড়াই order_id পাওয়ার জন্য

    for product, sale_quantity, base_quantity, sale_unit, unit_price, subtotal in order_items_data:
        db.add(OrderItem(
            order_id=new_order.order_id,
            product_id=product.product_id,
            quantity_kg=base_quantity,
            quantity=sale_quantity,
            unit=sale_unit,
            unit_price=unit_price,
            subtotal=subtotal,
        ))
        # bulk .update() এর পর in-memory ORM object automatically sync থাকে না, তাই refresh করে নেওয়া হচ্ছে
        db.refresh(product)
        if float(product.quantity_kg) <= 0:
            product.status = ProductStatus.sold_out

    create_notification(
        db,
        user_id=new_order.farmer_id,
        type="order_placed",
        title="🛒 New order received",
        message=f"{current_user.name_en} placed an order worth Tk.{total_amount} for {len(order_items_data)} item(s).",
        link="/farmer?tab=orders",
    )

    db.commit()
    db.refresh(new_order)

    print(f"  New order: {new_order.order_id} | {len(order_items_data)} item(s) | Tk.{total_amount}")
    return _build_order_response(new_order, db)


# ── GET /api/v1/orders ────────────────────────────────────────
@router.get("/", response_model=List[OrderResponse])
async def get_my_orders(
    status: Optional[OrderStatus] = Query(None),
    view: Optional[str] = Query(
        None,
        description="'buyer' বা 'seller' — কোন দিক থেকে order দেখতে চান, "
                    "স্পষ্টভাবে বলে দাও। না দিলে account role অনুযায়ী default হবে।"
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Buyer বা Farmer-এর সব orders দেখাও (প্রতিটা order-এ তার সব item সহ)।

    একজন farmer অন্য farmer-এর product-ও কিনতে পারে — তখন সেই একই user
    কখনো seller (নিজের product বিক্রি), কখনো buyer (অন্যের product কেনা)।
    তাই শুধু account role দিয়ে বোঝা যায় না কোন দিকের orders দেখানো উচিত —
    caller (frontend) স্পষ্টভাবে `view=buyer` বা `view=seller` পাঠায়।
    """
    if view == "buyer":
        query = db.query(Order).filter(Order.buyer_id == current_user.user_id)
    elif view == "seller":
        query = db.query(Order).filter(Order.farmer_id == current_user.user_id)
    elif current_user.role == UserRole.farmer:
        query = db.query(Order).filter(Order.farmer_id == current_user.user_id)
    else:
        query = db.query(Order).filter(Order.buyer_id == current_user.user_id)

    if status:
        query = query.filter(Order.status == status)

    orders = query.order_by(Order.created_at.desc()).all()
    return [_build_order_response(order, db) for order in orders]


# ── GET /api/v1/orders/{order_id} ────────────────────────────
@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """একটি order-এর details (সব item সহ) দেখাও।"""
    order = db.query(Order).filter(Order.order_id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if str(order.buyer_id) != str(current_user.user_id) and \
       str(order.farmer_id) != str(current_user.user_id) and \
       current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Access denied.")

    return _build_order_response(order, db)


# ── PUT /api/v1/orders/{order_id}/status ─────────────────────
@router.put("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: UUID,
    update: OrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Order status update করো (পুরো order-এর সব item-এর status একসাথে বদলায়)।"""
    order = db.query(Order).filter(Order.order_id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    new_status = update.status

    farmer_actions = [OrderStatus.confirmed, OrderStatus.ready,
                      OrderStatus.dispatched, OrderStatus.shipped, OrderStatus.in_transit,
                      OrderStatus.out_for_delivery, OrderStatus.delivered]

    is_farmer = str(order.farmer_id) == str(current_user.user_id)
    is_buyer = str(order.buyer_id) == str(current_user.user_id)

    if new_status in farmer_actions and not is_farmer:
        raise HTTPException(status_code=403, detail="Only the farmer can update to this status.")

    # cancel: buyer নিজের অর্ডার বাতিল করতে পারে, farmer ও 'placed' অর্ডার reject করতে পারে
    # (যেমন stock হঠাৎ শেষ হয়ে গেলে) — কিন্তু অন্য কেউ না
    if new_status == OrderStatus.cancelled and not (is_farmer or is_buyer):
        raise HTTPException(status_code=403, detail="Only the buyer or farmer can cancel this order.")

    # ── Terminal states আর বদলানো যাবে না ──
    # (delivered/cancelled order-কে re-trigger করলে escrow দ্বিতীয়বার release/refund
    #  হতে পারে — এই check ছাড়া payment integrity ভেঙে যাবে)
    if order.status in (OrderStatus.delivered, OrderStatus.cancelled):
        raise HTTPException(
            status_code=400,
            detail=f"This order is already '{order.status.value}' and cannot be changed further."
        )

    # ── Cancel শুধু 'placed' অবস্থায় করা যাবে (buyer বা farmer, দুজনের জন্যই) ──
    if new_status == OrderStatus.cancelled and order.status != OrderStatus.placed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order with status '{order.status.value}'. Only 'placed' orders can be cancelled."
        )

    order.status = new_status

    if new_status == OrderStatus.confirmed:
        order.confirmed_at = datetime.utcnow()

    if new_status == OrderStatus.delivered:
        order.delivered_at = datetime.utcnow()
        if order.payment_status == PaymentStatus.pending:
            order.payment_status = PaymentStatus.paid
        elif order.payment_status == PaymentStatus.in_escrow:
            order.payment_status = PaymentStatus.released
            print(f"  Escrow released: Tk.{order.farmer_amount} -> Farmer")

    if new_status == OrderStatus.cancelled:
        order.payment_status = (
            PaymentStatus.failed
            if order.payment_status == PaymentStatus.pending
            or order.payment_method in {PaymentMethod.mock_bkash, PaymentMethod.mock_nagad}
            else PaymentStatus.refunded
        )
        _restock_order_items(order, db)

    # ── Notify the other party — farmer's actions notify the buyer,
    #    and a cancel notifies whichever side didn't request it. ──
    recipient_id = order.buyer_id if is_farmer else order.farmer_id
    recipient_path = "/buyer" if is_farmer else "/farmer"
    status_label = new_status.value.replace("_", " ").title()
    create_notification(
        db,
        user_id=recipient_id,
        type="order_cancelled" if new_status == OrderStatus.cancelled else "order_status",
        title=f"📦 Order {status_label}",
        message=f"Order status updated to '{status_label}'.",
        link=f"{recipient_path}?tab=orders",
    )

    db.commit()
    db.refresh(order)
    return _build_order_response(order, db)


# ── DELETE /api/v1/orders/{order_id} ─────────────────────────
@router.delete("/{order_id}")
async def cancel_order(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Order cancel করো (শুধু placed status-এ, buyer নিজে)।"""
    order = db.query(Order).filter(Order.order_id == order_id).with_for_update().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if str(order.buyer_id) != str(current_user.user_id):
        raise HTTPException(status_code=403, detail="Only the buyer can cancel this order.")

    if order.status != OrderStatus.placed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order with status '{order.status.value}'. Only 'placed' orders can be cancelled."
        )

    order.status = OrderStatus.cancelled
    order.payment_status = (
        PaymentStatus.failed
        if order.payment_status == PaymentStatus.pending
        or order.payment_method in {PaymentMethod.mock_bkash, PaymentMethod.mock_nagad}
        else PaymentStatus.refunded
    )
    _restock_order_items(order, db)

    create_notification(
        db,
        user_id=order.farmer_id,
        type="order_cancelled",
        title="❌ Order cancelled",
        message=f"{current_user.name_en} cancelled their order.",
        link="/farmer?tab=orders",
    )

    db.commit()
    message = (
        "Order cancelled and payment refunded."
        if order.payment_status == PaymentStatus.refunded
        else "Order cancelled."
    )
    return {"message": message, "order_id": str(order_id)}


# ── GET /api/v1/orders/admin/all ─────────────────────────────
@router.get("/admin/all", response_model=List[OrderResponse])
async def get_all_orders(
    status: Optional[OrderStatus] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin সব orders দেখতে পারবে (প্রতিটা তার সব item সহ)।"""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)

    orders = query.order_by(Order.created_at.desc()).limit(100).all()
    return [_build_order_response(order, db) for order in orders]
