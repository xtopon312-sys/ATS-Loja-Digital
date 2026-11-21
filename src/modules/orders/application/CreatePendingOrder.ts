import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'
import { operationalStore } from '../../commerce/application/policies'
import type { Runtime, UnitOfWork } from '../../commerce/application/UnitOfWork'
import { consolidate, minimalCustomer, type Customer, type Order, type OrderItem } from '../domain/Order'

export class CreatePendingOrder {
  constructor(private uow: UnitOfWork, private runtime: Runtime) {}
  execute(input: { storeId: string; items: readonly { productId: string; quantity: number }[];
    customer: Customer; idempotencyKey: string }): Promise<Order> {
    input = { ...input }
    const items = consolidate(input.items)
    const customer = minimalCustomer(input.customer)
    const key = nonempty(input.idempotencyKey)
    const fingerprint = JSON.stringify({ items, customer })
    return this.uow.run(async tx => {
      await operationalStore(tx, input.storeId)
      const previous = await tx.orders.findByIdempotencyKey(input.storeId, key)
      if (previous) {
        requireRule(previous.requestFingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT')
        return previous
      }
      const snapshots: OrderItem[] = []
      let totalCents = 0
      for (const item of items) {
        const product = await tx.products.get(input.storeId, item.productId)
        requireRule(product, 'PRODUCT_NOT_FOUND')
        requireRule(product.storeId === input.storeId, 'CROSS_STORE_ACCESS')
        requireRule(product.status === 'ACTIVE', 'PRODUCT_UNAVAILABLE')
        integer(product.priceCents, 0, 'INVALID_PRICE')
        const subtotalCents = integer(product.priceCents * item.quantity, 0, 'INVALID_PRICE')
        totalCents = integer(totalCents + subtotalCents, 0, 'INVALID_PRICE')
        snapshots.push({ ...item, name: product.name, unitPriceCents: product.priceCents, subtotalCents })
      }
      const order: Order = { id: this.runtime.nextId(), storeId: input.storeId, status: 'PENDING', items: snapshots,
        totalCents, customer, createdAt: this.runtime.now(), confirmedAt: null, cancelledAt: null, reversedAt: null,
        confirmedBy: null, cancelledBy: null, reversedBy: null, idempotencyKey: key, requestFingerprint: fingerprint }
      await tx.orders.insert(order)
      return order
    })
  }
}
