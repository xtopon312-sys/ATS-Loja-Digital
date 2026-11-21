import { checkoutCustomer, normalizedPhone, type CheckoutInput, type OrderReceipt } from './Checkout'
export interface CheckoutSession { version: 1; storeId: string; input: CheckoutInput; receipt?: OrderReceipt }
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(key => keys.includes(key))
export function decodeCheckoutSession(raw: string | null, storeId: string, slug: string): CheckoutSession | undefined {
  try {
    if (!raw || raw.length > 24000) return undefined
    const s: unknown = JSON.parse(raw)
    if (!isRecord(s) || !exact(s, ['version', 'storeId', 'input', 'receipt']) || s.version !== 1 || s.storeId !== storeId || !isRecord(s.input)) return undefined
    const input = s.input
    if (!exact(input, ['slug', 'items', 'customer', 'idempotencyKey']) || input.slug !== slug || typeof input.idempotencyKey !== 'string'
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.idempotencyKey)
      || !Array.isArray(input.items) || !input.items.length || input.items.length > 50 || !isRecord(input.customer)) return undefined
    if (input.items.some(i => !isRecord(i) || !exact(i, ['productId', 'quantity']) || typeof i.productId !== 'string'
      || !/^[a-zA-Z0-9_-]{1,128}$/.test(i.productId) || !Number.isSafeInteger(i.quantity) || Number(i.quantity) < 1 || Number(i.quantity) > 5)) return undefined
    if (!exact(input.customer, ['name', 'phone', 'note'])) return undefined
    checkoutCustomer(input.customer as unknown as CheckoutInput['customer'])
    if (s.receipt !== undefined) {
      if (!isRecord(s.receipt) || !exact(s.receipt, ['id', 'storeId', 'storeName', 'whatsapp', 'items', 'totalCents', 'customer', 'createdAt'])) return undefined
      const r = s.receipt
      if (r.storeId !== storeId || typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(r.id) || typeof r.storeName !== 'string'
        || typeof r.createdAt !== 'string' || !Number.isFinite(Date.parse(r.createdAt)) || typeof r.whatsapp !== 'string'
        || !Array.isArray(r.items) || r.items.length === 0 || r.items.length > 50 || !Number.isSafeInteger(r.totalCents) || Number(r.totalCents) < 0 || !isRecord(r.customer)) return undefined
      normalizedPhone(r.whatsapp); checkoutCustomer(r.customer as unknown as CheckoutInput['customer'])
      let total = 0
      for (const item of r.items) {
        if (!isRecord(item) || !exact(item, ['productId', 'name', 'quantity', 'unitPriceCents', 'subtotalCents']) || typeof item.name !== 'string'
          || typeof item.productId !== 'string' || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || !Number.isSafeInteger(item.unitPriceCents)
          || Number(item.unitPriceCents) < 0 || !Number.isSafeInteger(item.subtotalCents) || item.subtotalCents !== Number(item.quantity) * Number(item.unitPriceCents)) return undefined
        total += Number(item.subtotalCents)
      }
      if (total !== r.totalCents) return undefined
    }
    return s as unknown as CheckoutSession
  } catch { return undefined }
}
