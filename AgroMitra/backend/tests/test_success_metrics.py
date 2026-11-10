import asyncio
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy.sql.elements import BinaryExpression

from backend.database.models.order import Order
from backend.database.models.product import Product, ProductStatus
from backend.database.models.user import UserRole
from backend.database.routes import auth_routes, order_routes
from backend.database.schemas.order_schema import OrderCreate, OrderItemCreate
from backend.database.schemas.user_schema import UserLogin
from backend.database.utils.order_finance import calculate_order_totals
from backend.database.utils.review_eligibility import review_eligibility_error


class _Query:
    def __init__(self, db, model):
        self.db = db
        self.model = model

    def filter(self, *_conditions):
        return self

    def all(self):
        return [self.db.product]

    def update(self, values, synchronize_session=False):
        del synchronize_session
        quantity_expression = values["quantity_kg"]
        assert isinstance(quantity_expression, BinaryExpression)
        requested = Decimal(str(quantity_expression.right.value))
        if self.db.product.quantity_kg < requested:
            return 0
        self.db.product.quantity_kg -= requested
        return 1


class _OrderDB:
    def __init__(self, product):
        self.product = product
        self.added = []
        self.commits = 0
        self.rollbacks = 0

    def query(self, model):
        assert model is Product
        return _Query(self, model)

    def add(self, value):
        self.added.append(value)

    def flush(self):
        for value in self.added:
            if isinstance(value, Order) and value.order_id is None:
                value.order_id = uuid4()

    def refresh(self, _value):
        return None

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class _AuthQuery:
    def __init__(self, user):
        self.user = user

    def filter(self, *_conditions):
        return self

    def first(self):
        return self.user


class _AuthDB:
    def __init__(self, user):
        self.user = user
        self.commits = 0

    def query(self, _model):
        return _AuthQuery(self.user)

    def commit(self):
        self.commits += 1


def test_login_authenticates_user_and_returns_tokens():
    user = SimpleNamespace(
        user_id=uuid4(),
        mobile_number="01711223344",
        role=UserRole.buyer,
        password_hash="hashed",
        is_active=True,
        last_login_at=None,
    )
    db = _AuthDB(user)
    expected_tokens = object()

    with (
        patch.object(auth_routes, "check_login_lockout", return_value=(0, False)),
        patch.object(auth_routes, "verify_password", return_value=True),
        patch.object(auth_routes, "reset_login_attempts") as reset_attempts,
        patch.object(auth_routes, "_create_user_tokens", return_value=expected_tokens),
    ):
        response = asyncio.run(auth_routes.login(
            UserLogin(mobile_number=user.mobile_number, password="correct"),
            db,
        ))

    assert response is expected_tokens
    assert db.commits == 1
    assert user.last_login_at is not None
    reset_attempts.assert_called_once_with(user.mobile_number)


def test_login_rejects_an_incorrect_password():
    user = SimpleNamespace(
        user_id=uuid4(),
        mobile_number="01711223344",
        role=UserRole.buyer,
        password_hash="hashed",
        is_active=True,
    )
    db = _AuthDB(user)

    with (
        patch.object(auth_routes, "check_login_lockout", return_value=(0, False)),
        patch.object(auth_routes, "verify_password", return_value=False),
        patch.object(auth_routes, "record_failed_login") as record_failure,
    ):
        with pytest.raises(HTTPException) as error:
            asyncio.run(auth_routes.login(
                UserLogin(mobile_number=user.mobile_number, password="wrong"),
                db,
            ))

    assert error.value.status_code == 401
    assert db.commits == 0
    record_failure.assert_called_once_with(user.mobile_number)


def test_order_creation_decrements_stock_and_records_fee_totals():
    farmer_id = uuid4()
    product = Product(
        product_id=uuid4(),
        farmer_id=farmer_id,
        title_en="Tomato",
        category="Vegetable",
        quantity_kg=Decimal("5.00"),
        sale_unit="kg",
        unit_price_bdt=Decimal("100.00"),
        district="Dhaka",
        status=ProductStatus.active,
    )
    buyer = SimpleNamespace(user_id=uuid4(), name_en="Buyer")
    db = _OrderDB(product)
    request = OrderCreate(items=[
        OrderItemCreate(product_id=product.product_id, quantity_kg=Decimal("2.00")),
    ])

    with (
        patch.object(order_routes, "get_platform_fee_percent", return_value=Decimal("3")),
        patch.object(order_routes, "create_notification"),
        patch.object(order_routes, "_build_order_response", side_effect=lambda order, _db: order),
    ):
        created = asyncio.run(order_routes.place_order(request, buyer, db))

    assert product.quantity_kg == Decimal("3.00")
    assert created.total_amount == Decimal("200.00")
    assert created.platform_fee == Decimal("6.00")
    assert created.farmer_amount == Decimal("194.00")
    assert db.commits == 1
    assert db.rollbacks == 0


@pytest.mark.parametrize(
    ("subtotal_input", "fee_percent", "expected_fee", "expected_farmer_amount"),
    [
        ("100.00", "3", Decimal("3.00"), Decimal("97.00")),
        ("10.00", "2.5", Decimal("0.25"), Decimal("9.75")),
    ],
)
def test_fee_calculation(subtotal_input, fee_percent, expected_fee, expected_farmer_amount):
    subtotal, fee, farmer_amount = calculate_order_totals(subtotal_input, fee_percent)

    assert subtotal == Decimal(subtotal_input)
    assert fee == expected_fee
    assert farmer_amount == expected_farmer_amount


@pytest.mark.parametrize(
    ("review_inputs", "expected_error"),
    [
        (
            {"is_buyer": True, "owns_order": True, "delivered": True, "already_reviewed": False},
            None,
        ),
        (
            {"is_buyer": False, "owns_order": True, "delivered": True, "already_reviewed": False},
            (403, "Only buyers can submit reviews."),
        ),
        (
            {"is_buyer": True, "owns_order": False, "delivered": True, "already_reviewed": False},
            (403, "You can only review products from your own orders."),
        ),
        (
            {"is_buyer": True, "owns_order": True, "delivered": False, "already_reviewed": False},
            (400, "You can only review products after delivery is confirmed."),
        ),
        (
            {"is_buyer": True, "owns_order": True, "delivered": True, "already_reviewed": True},
            (409, "You have already reviewed this product."),
        ),
    ],
)
def test_review_eligibility(review_inputs, expected_error):
    assert review_eligibility_error(**review_inputs) == expected_error
