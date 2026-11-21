import { Timestamp } from 'firebase-admin/firestore'
import { integer, requireRule } from '../../src/shared/domain/DomainError'
import { validateProduct, type Product } from '../../src/modules/products/domain/Product'
import { consolidate, minimalCustomer, type Order } from '../../src/modules/orders/domain/Order'
import type { StockMovement } from '../../src/modules/inventory/domain/StockMovement'

export function record(value: unknown): Record<string, unknown> {
  requireRule(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_INPUT')
  return value as Record<string, unknown>
}
export function text(value: unknown, max = 120): string {
  requireRule(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'INVALID_INPUT')
  return value
}
export function id(value: unknown): string {
  const result = text(value, 128)
  requireRule(/^[a-zA-Z0-9_-]+$/.test(result), 'INVALID_INPUT')
  return result
}
export function date(value: unknown): string {
  const result = value instanceof Timestamp ? value.toDate().toISOString() : text(value, 40)
  requireRule(Number.isFinite(Date.parse(result)), 'INVALID_INPUT')
  return new Date(result).toISOString()
}
export function productDto(value: unknown, storeId: string, productId: string): Product {
  const d = record(value)
  requireRule(d.storeId === storeId && d.id === productId, 'CROSS_STORE_ACCESS')
  requireRule(typeof d.description === 'string' && d.description.length <= 2000, 'INVALID_INPUT')
  const result: Product = { id: id(d.id), storeId: id(d.storeId), name: text(d.name), description: d.description,
    priceCents: integer(d.priceCents as number, 0, 'INVALID_PRICE'), stock: integer(d.stock as number, 0, 'INVALID_STOCK'),
    categoryId: id(d.categoryId), status: d.status as Product['status'], createdAt: date(d.createdAt), updatedAt: date(d.updatedAt) }
  validateProduct(result)
  return result
}
export function orderDto(value: unknown, storeId: string, orderId: string): Order {
  const d = record(value)
  requireRule(d.storeId === storeId && d.id === orderId, 'CROSS_STORE_ACCESS')
  requireRule(['PENDING', 'CONFIRMED', 'CANCELLED', 'REVERSED'].includes(String(d.status)), 'INVALID_ORDER_STATE')
  requireRule(Array.isArray(d.items) && d.items.length <= 50, 'INVALID_INPUT')
  const items = d.items.map(value => {
    const item = record(value)
    const quantity = integer(item.quantity as number, 1, 'INVALID_QUANTITY')
    const unitPriceCents = integer(item.unitPriceCents as number, 0, 'INVALID_PRICE')
    const subtotalCents = integer(item.subtotalCents as number, 0, 'INVALID_PRICE')
    requireRule(subtotalCents === quantity * unitPriceCents, 'INVALID_PRICE')
    return { productId: id(item.productId), name: text(item.name), quantity, unitPriceCents, subtotalCents }
  })
  requireRule(consolidate(items).length === items.length, 'INVALID_INPUT')
  const totalCents = integer(d.totalCents as number, 0, 'INVALID_PRICE')
  requireRule(totalCents === items.reduce((sum, item) => sum + item.subtotalCents, 0), 'INVALID_PRICE')
  const c = record(d.customer)
  const customer = minimalCustomer({ name: text(c.name), ...(c.phone === undefined ? {} : { phone: text(c.phone, 32) }),
    ...(c.note === undefined ? {} : { note: text(c.note, 500) }) })
  return { id: id(d.id), storeId: id(d.storeId), status: d.status as Order['status'], items, totalCents, customer,
    createdAt: date(d.createdAt), confirmedAt: d.confirmedAt === null ? null : date(d.confirmedAt),
    cancelledAt: d.cancelledAt === null ? null : date(d.cancelledAt), reversedAt: d.reversedAt === null ? null : date(d.reversedAt),
    confirmedBy: d.confirmedBy === null ? null : id(d.confirmedBy), cancelledBy: d.cancelledBy === null ? null : id(d.cancelledBy),
    reversedBy: d.reversedBy === null ? null : id(d.reversedBy), idempotencyKey: text(d.idempotencyKey, 256), requestFingerprint: text(d.requestFingerprint, 20000) }
}
export function movementDto(value: unknown, storeId: string): StockMovement {
  const d = record(value)
  requireRule(d.storeId === storeId, 'CROSS_STORE_ACCESS')
  requireRule(['MANUAL_ENTRY', 'MANUAL_EXIT', 'ORDER_CONFIRMED', 'ORDER_REVERSED'].includes(String(d.type)), 'INVALID_STOCK_HISTORY')
  const movement: StockMovement = { id: id(d.id), storeId, productId: id(d.productId), type: d.type as StockMovement['type'],
    quantity: integer(d.quantity as number, 1, 'INVALID_QUANTITY'), previousStock: integer(d.previousStock as number, 0, 'INVALID_STOCK'),
    newStock: integer(d.newStock as number, 0, 'INVALID_STOCK'), reason: text(d.reason, 500), createdAt: date(d.createdAt),
    createdBy: id(d.createdBy), idempotencyKey: text(d.idempotencyKey, 512), ...(d.orderId === undefined ? {} : { orderId: id(d.orderId) }) }
  const entering = movement.type === 'MANUAL_ENTRY' || movement.type === 'ORDER_REVERSED'
  requireRule(movement.newStock === movement.previousStock + (entering ? movement.quantity : -movement.quantity), 'INVALID_STOCK_HISTORY')
  return movement
}
export function timestamps<T extends object>(value: T): Record<string, unknown> {
  const result = structuredClone(value) as Record<string, unknown>
  for (const key of ['createdAt', 'updatedAt', 'confirmedAt', 'cancelledAt', 'reversedAt']) {
    if (typeof result[key] === 'string') result[key] = Timestamp.fromDate(new Date(result[key] as string))
  }
  return result
}
