import type { PublicCatalog, PublicProduct } from './PublicCatalog'

export interface CartItem { productId: string; quantity: number }
export interface CartLine extends CartItem { product: PublicProduct; subtotalCents: number }
export interface CartView { items: CartItem[]; lines: CartLine[]; quantity: number; subtotalCents: number }
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)

export function decodeCart(raw: string | null, storeId: string): CartItem[] {
  if (!raw || raw.length > 12000) return []
  try {
    const data = JSON.parse(raw)
    if (!data || data.version !== 1 || data.storeId !== storeId || !Array.isArray(data.items) || data.items.length > 50
      || Object.keys(data).some(key => !['version', 'storeId', 'items'].includes(key))) return []
    const ids = new Set<string>()
    for (const item of data.items) {
      if (!item || !validId(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 5
        || Object.keys(item).some(key => !['productId', 'quantity'].includes(key)) || ids.has(item.productId)) return []
      ids.add(item.productId)
    }
    return data.items.map((item: CartItem) => ({ productId: item.productId, quantity: item.quantity }))
  } catch { return [] }
}
export function encodeCart(storeId: string, items: CartItem[]): string { return JSON.stringify({ version: 1, storeId, items }) }
export function reconcileCart(items: CartItem[], catalog: PublicCatalog): CartView {
  const lines: CartLine[] = []
  let subtotalCents = 0
  const ids = new Set<string>()
  for (const item of items.slice(0, 50)) {
    const product = catalog.products.find(p => p.id === item.productId && p.storeId === catalog.store.storeId && p.publishable && p.available)
    if (!product || ids.has(product.id) || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue
    ids.add(product.id)
    const quantity = Math.min(item.quantity, product.maxQuantity)
    const subtotal = product.priceCents * quantity
    if (!quantity || !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(subtotalCents + subtotal)) continue
    subtotalCents += subtotal
    lines.push({ productId: product.id, quantity, product, subtotalCents: subtotal })
  }
  return { lines, subtotalCents, quantity: lines.reduce((sum, line) => sum + line.quantity, 0), items: lines.map(({ productId, quantity }) => ({ productId, quantity })) }
}
export function changeCart(items: CartItem[], catalog: PublicCatalog, productId: string, quantity: number): CartView {
  return reconcileCart([...items.filter(item => item.productId !== productId), { productId, quantity }], catalog)
}
