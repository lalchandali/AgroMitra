def review_eligibility_error(
    *,
    is_buyer: bool,
    owns_order: bool,
    delivered: bool,
    already_reviewed: bool,
):
    if not is_buyer:
        return 403, "Only buyers can submit reviews."
    if not owns_order:
        return 403, "You can only review products from your own orders."
    if not delivered:
        return 400, "You can only review products after delivery is confirmed."
    if already_reviewed:
        return 409, "You have already reviewed this product."
    return None
