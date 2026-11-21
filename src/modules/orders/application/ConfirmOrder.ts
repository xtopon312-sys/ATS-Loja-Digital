import { authorize, type ActorContext } from '../../../shared/domain/ActorContext'
import { integer, requireRule } from '../../../shared/domain/DomainError'
import { operationalStore } from '../../commerce/application/policies'
import type { Runtime, UnitOfWork } from '../../commerce/application/UnitOfWork'
import { recordStockChange } from '../../inventory/application/recordStockChange'
import { consolidate, type Order } from '../domain/Order'

export class ConfirmOrder {
  constructor(private uow: UnitOfWork, private runtime: Runtime) {}
  execute(actor: ActorContext, storeId: string, orderId: string): Promise<Order> {
    const actorId = authorize(actor, storeId)
    return this.uow.run(async tx => {
      await operationalStore(tx, storeId)
      const order = await tx.orders.get(storeId, orderId)
      requireRule(order, 'ORDER_NOT_FOUND')
      requireRule(order.storeId === storeId, 'CROSS_STORE_ACCESS')
      if (order.status === 'CONFIRMED') return order
      requireRule(order.status === 'PENDING', 'INVALID_ORDER_STATE')
      const entries = []
      for (const item of consolidate(order.items)) {
        const product = await tx.products.get(storeId, item.productId)
        requireRule(product, 'PRODUCT_NOT_FOUND')
        requireRule(product.storeId === storeId, 'CROSS_STORE_ACCESS')
        requireRule(product.status === 'ACTIVE', 'PRODUCT_UNAVAILABLE')
        integer(product.stock, 0, 'INVALID_STOCK')
        requireRule(product.stock >= item.quantity, 'INSUFFICIENT_STOCK')
        entries.push({ product, quantity: item.quantity })
      }
      for (const entry of entries) {
        await recordStockChange(tx, this.runtime, entry.product, { type: 'ORDER_CONFIRMED', quantity: entry.quantity,
          actorId, reason: 'Order confirmed', orderId, idempotencyKey: JSON.stringify(['confirm', orderId, entry.product.id]) })
      }
      const updated: Order = { ...order, status: 'CONFIRMED', confirmedAt: this.runtime.now(), confirmedBy: actorId }
      await tx.orders.update(storeId, updated)
      return updated
    })
  }
}
