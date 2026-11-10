import unittest
from contextlib import redirect_stdout
from decimal import Decimal
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from backend.database.models.order import DeliveryType, PaymentMethod
from backend.database.models.product import Product, ProductStatus, StockStatus
from backend.database.models.user import UserRole
from backend.database.routes import auth_routes
from backend.database.routes.auth_routes import _log_development_otp
from backend.database.schemas.order_schema import OrderCreate, OrderItemCreate
from backend.database.schemas.user_schema import OTPRequest
from backend.database.utils.order_finance import calculate_order_totals
from backend.database.utils.quantity_units import (
    calculate_sale_line,
    quantity_from_base,
    quantity_to_base,
)
from backend.database.utils.review_eligibility import review_eligibility_error
from fastapi import HTTPException
from pydantic import ValidationError


class ProductStockStatusTests(unittest.TestCase):
    def test_quantity_at_or_below_listing_threshold_is_low_stock(self):
        product = Product(
            quantity_kg=Decimal("5.00"),
            low_stock_threshold_kg=Decimal("5.00"),
            status=ProductStatus.active,
        )

        self.assertEqual(product.stock_status, StockStatus.low_stock)

    def test_quantity_above_listing_threshold_is_in_stock(self):
        product = Product(
            quantity_kg=Decimal("5.01"),
            low_stock_threshold_kg=Decimal("5.00"),
            status=ProductStatus.active,
        )

        self.assertEqual(product.stock_status, StockStatus.in_stock)

    def test_zero_quantity_or_sold_out_status_is_out_of_stock(self):
        zero_quantity = Product(
            quantity_kg=Decimal("0.00"),
            low_stock_threshold_kg=Decimal("5.00"),
            status=ProductStatus.active,
        )
        marked_sold_out = Product(
            quantity_kg=Decimal("2.00"),
            low_stock_threshold_kg=Decimal("5.00"),
            status=ProductStatus.sold_out,
        )

        self.assertEqual(zero_quantity.stock_status, StockStatus.out_of_stock)
        self.assertEqual(marked_sold_out.stock_status, StockStatus.out_of_stock)


    def test_quantity_is_returned_in_the_selected_sale_unit(self):
        maund_product = Product(quantity_kg=Decimal("80"), sale_unit="maund")
        dozen_product = Product(quantity_kg=Decimal("24"), sale_unit="dozen")

        self.assertEqual(maund_product.quantity, 2.0)
        self.assertEqual(dozen_product.quantity, 2.0)


class LocalQuantityUnitTests(unittest.TestCase):
    def test_maund_normalizes_to_forty_kilograms(self):
        self.assertEqual(quantity_to_base("2", "maund"), Decimal("80.00"))
        self.assertEqual(quantity_from_base("80", "maund"), Decimal("2.00"))

    def test_dozen_normalizes_to_twelve_pieces(self):
        self.assertEqual(quantity_to_base("2", "dozen"), Decimal("24.00"))
        self.assertEqual(quantity_from_base("24", "dozen"), Decimal("2.00"))

    def test_count_units_must_be_whole_units(self):
        with self.assertRaises(ValueError):
            quantity_to_base("1.5", "piece")
        with self.assertRaises(ValueError):
            quantity_to_base("1.5", "dozen")

    def test_unsupported_unit_is_rejected(self):
        with self.assertRaises(ValueError):
            quantity_to_base(1, "bag")

    def test_order_line_subtotal_uses_sale_units_and_stock_uses_base_units(self):
        sale_quantity, stock_quantity, subtotal = calculate_sale_line(2, "maund", 700)

        self.assertEqual(sale_quantity, Decimal("2.00"))
        self.assertEqual(stock_quantity, Decimal("80.00"))
        self.assertEqual(subtotal, Decimal("1400.00"))


class OtpConsoleLoggingTests(unittest.TestCase):
    def test_otp_is_logged_only_when_the_development_setting_is_enabled(self):
        output = StringIO()
        with patch("backend.database.routes.auth_routes.OTP_LOG_TO_CONSOLE", True):
            with redirect_stdout(output):
                _log_development_otp("01711223344", "123456")
        self.assertIn("123456", output.getvalue())

        output = StringIO()
        with patch("backend.database.routes.auth_routes.OTP_LOG_TO_CONSOLE", False):
            with redirect_stdout(output):
                _log_development_otp("01711223344", "123456")
        self.assertEqual(output.getvalue(), "")


class FarmerOtpRequestTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.farmer = SimpleNamespace(role=UserRole.farmer, is_active=True)
        query = SimpleNamespace()
        query.filter = lambda *_args, **_kwargs: query
        query.first = lambda: self.farmer
        self.db = SimpleNamespace(query=lambda *_args: query)
        self.request = OTPRequest(mobile_number="01711223344")

    async def test_active_farmer_receives_a_console_logged_mock_otp(self):
        with (
            patch.object(auth_routes, "IS_PRODUCTION", False),
            patch.object(auth_routes, "generate_otp", return_value="123456"),
            patch.object(auth_routes, "_log_development_otp") as log_otp,
        ):
            response = await auth_routes.request_login_otp(self.request, self.db)

        log_otp.assert_called_once_with("01711223344", "123456")
        self.assertNotIn("dev_otp", response)

    async def test_customer_cannot_request_farmer_otp(self):
        self.farmer.role = UserRole.buyer
        with patch.object(auth_routes, "IS_PRODUCTION", False):
            with self.assertRaises(HTTPException) as error:
                await auth_routes.request_login_otp(self.request, self.db)

        self.assertEqual(error.exception.status_code, 400)

    async def test_production_does_not_issue_a_console_mock_otp(self):
        with (
            patch.object(auth_routes, "IS_PRODUCTION", True),
            patch.object(auth_routes, "generate_otp") as generate,
            patch.object(auth_routes, "_log_development_otp") as log_otp,
        ):
            with self.assertRaises(HTTPException) as error:
                await auth_routes.request_login_otp(self.request, self.db)

        self.assertEqual(error.exception.status_code, 503)
        generate.assert_not_called()
        log_otp.assert_not_called()


class OrderFinanceTests(unittest.TestCase):
    def test_platform_fee_is_rounded_and_deducted_from_farmer_amount(self):
        subtotal, fee, farmer_amount = calculate_order_totals("100.00", "3")

        self.assertEqual(subtotal, Decimal("100.00"))
        self.assertEqual(fee, Decimal("3.00"))
        self.assertEqual(farmer_amount, Decimal("97.00"))

    def test_fee_rounding_uses_two_decimal_places(self):
        _, fee, farmer_amount = calculate_order_totals("10.00", "2.5")

        self.assertEqual(fee, Decimal("0.25"))
        self.assertEqual(farmer_amount, Decimal("9.75"))


class OrderRequestDefaultsTests(unittest.TestCase):
    def test_cash_on_delivery_and_pickup_are_the_defaults(self):
        order = OrderCreate(items=[
            OrderItemCreate(product_id=uuid4(), quantity_kg=1),
        ])

        self.assertEqual(order.payment_method, PaymentMethod.cash_on_delivery)
        self.assertEqual(order.delivery_method, DeliveryType.pickup)

    def test_legacy_delivery_type_input_remains_accepted(self):
        order = OrderCreate(
            items=[OrderItemCreate(product_id=uuid4(), quantity_kg=1)],
            delivery_type=DeliveryType.delivery,
        )

        self.assertEqual(order.delivery_method, DeliveryType.delivery)

    def test_quantity_precision_matches_product_stock_storage(self):
        with self.assertRaises(ValidationError):
            OrderItemCreate(product_id=uuid4(), quantity_kg="0.001")

    def test_order_quantity_can_use_sale_unit_field(self):
        item = OrderItemCreate(product_id=uuid4(), quantity="2")

        self.assertEqual(item.quantity, Decimal("2"))


class ReviewEligibilityTests(unittest.TestCase):
    def test_only_buyer_owned_delivered_unreviewed_order_item_is_eligible(self):
        self.assertIsNone(review_eligibility_error(
            is_buyer=True,
            owns_order=True,
            delivered=True,
            already_reviewed=False,
        ))

    def test_review_is_rejected_when_order_is_not_owned(self):
        self.assertEqual(
            review_eligibility_error(is_buyer=True, owns_order=False, delivered=True, already_reviewed=False),
            (403, "You can only review products from your own orders."),
        )

    def test_review_is_rejected_before_delivery(self):
        self.assertEqual(
            review_eligibility_error(is_buyer=True, owns_order=True, delivered=False, already_reviewed=False),
            (400, "You can only review products after delivery is confirmed."),
        )

    def test_buyer_cannot_review_same_product_twice_across_orders(self):
        self.assertEqual(
            review_eligibility_error(is_buyer=True, owns_order=True, delivered=True, already_reviewed=True),
            (409, "You have already reviewed this product."),
        )

    def test_non_buyers_cannot_submit_reviews(self):
        self.assertEqual(
            review_eligibility_error(
                is_buyer=False,
                owns_order=True,
                delivered=True,
                already_reviewed=False,
            ),
            (403, "Only buyers can submit reviews."),
        )


if __name__ == "__main__":
    unittest.main()
