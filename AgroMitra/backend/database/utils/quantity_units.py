from decimal import Decimal

SALE_UNIT_BASE = {
    "kg": Decimal("1"),
    "maund": Decimal("40"),
    "dozen": Decimal("12"),
    "piece": Decimal("1"),
}


def normalize_sale_unit(unit: str) -> str:
    normalized = (unit or "").strip().lower()
    if normalized not in SALE_UNIT_BASE:
        raise ValueError(f"Unsupported sale unit: {unit}")
    return normalized


def quantity_to_base(quantity, unit: str) -> Decimal:
    normalized = normalize_sale_unit(unit)
    multiplier = SALE_UNIT_BASE[normalized]
    value = Decimal(str(quantity))
    if normalized in {"dozen", "piece"} and value != value.to_integral_value():
        raise ValueError("Count-unit quantities must be whole numbers.")
    return (value * multiplier).quantize(Decimal("0.01"))


def quantity_from_base(quantity, unit: str) -> Decimal:
    normalized = normalize_sale_unit(unit)
    multiplier = SALE_UNIT_BASE[normalized]
    return (Decimal(str(quantity)) / multiplier).quantize(Decimal("0.01"))


def calculate_sale_line(quantity, unit: str, unit_price):
    sale_quantity = Decimal(str(quantity)).quantize(Decimal("0.01"))
    if sale_quantity <= 0:
        raise ValueError("Order quantities must be positive.")
    base_quantity = quantity_to_base(sale_quantity, unit)
    subtotal = (Decimal(str(unit_price)) * sale_quantity).quantize(Decimal("0.01"))
    return sale_quantity, base_quantity, subtotal
