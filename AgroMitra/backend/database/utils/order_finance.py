from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def calculate_order_totals(items_subtotal, platform_fee_percent):
    subtotal = Decimal(str(items_subtotal)).quantize(CENT, rounding=ROUND_HALF_UP)
    fee_percent = Decimal(str(platform_fee_percent))
    platform_fee = (subtotal * fee_percent / Decimal("100")).quantize(
        CENT,
        rounding=ROUND_HALF_UP,
    )
    farmer_amount = subtotal - platform_fee
    return subtotal, platform_fee, farmer_amount
