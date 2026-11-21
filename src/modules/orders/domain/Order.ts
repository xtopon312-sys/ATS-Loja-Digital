import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'

export interface OrderItem {
  productId: string
  name: string
  unitPriceCents: number
  quantity: number
  subtotalCents: number
}
export interface Customer { name: string; phone?: string; note?: string }
export interface Order {
  id: string
  storeId: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REVERSED'
  items: OrderItem[]
  totalCents: number
  customer: Customer
  createdAt: string
  confirmedAt: string | null
  cancelledAt: string | null
  reversedAt: string | null
  confirmedBy: string | null
  cancelledBy: string | null
  reversedBy: string | null
  idempotencyKey: string
  requestFingerprint: string
}

export function consolidate(items: readonly { productId: string; quantity: number }[]) {
  requireRule(Array.isArray(items) && items.length > 0, 'INVALID_QUANTITY')
  const quantities = new Map<string, number>()
  for (const item of items) {
    nonempty(item.productId)
    integer(item.quantity, 1, 'INVALID_QUANTITY')
    quantities.set(item.productId, integer((quantities.get(item.productId) ?? 0) + item.quantity, 1, 'INVALID_QUANTITY'))
  }
  return [...quantities].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([productId, quantity]) => ({ productId, quantity }))
}

export function minimalCustomer(customer: Customer): Customer {
  const name = nonempty(customer.name)
  requireRule(name.length <= 120, 'INVALID_INPUT')
  const note = customer.note === undefined ? undefined : nonempty(customer.note)
  requireRule(note === undefined || note.length <= 500, 'INVALID_INPUT')
  const result = { name, ...(note === undefined ? {} : { note }) }
  if (customer.phone === undefined) return result
  const phone = nonempty(customer.phone)
  requireRule(phone.length <= 32, 'INVALID_INPUT')
  return { ...result, phone }
}
