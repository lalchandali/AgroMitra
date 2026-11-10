export const UNIT_TO_BASE = {
  kg: 1,
  maund: 40,
  dozen: 12,
  piece: 1,
}

export const displayQuantity = (product) => {
  if (product?.quantity != null) return Number(product.quantity)
  const multiplier = UNIT_TO_BASE[product?.sale_unit || 'kg'] || 1
  return Number(product?.quantity_kg || 0) / multiplier
}

export const displayUnit = (productOrUnit) => (
  typeof productOrUnit === 'string'
    ? productOrUnit
    : productOrUnit?.sale_unit || 'kg'
)

export const orderItemQuantity = (item) => (
  item?.quantity != null
    ? Number(item.quantity)
    : Number(item?.quantity_kg || 0)
)

export const orderItemUnit = (item) => item?.unit || 'kg'
