import { authorize, type ActorContext } from '../../../shared/domain/ActorContext'
import { integer, requireRule } from '../../../shared/domain/DomainError'
import type { Runtime, UnitOfWork } from '../../commerce/application/UnitOfWork'
import { recordStockChange } from '../../inventory/application/recordStockChange'
import { consolidate, type Order } from '../domain/Order'

export class ReverseConfirmedOrder {
  constructor(private uow: UnitOfWork, private runtime: Runtime) {}
  execute(actor: ActorContext, storeId: string, orderId: string): Promise<Order> {
    const actorId = authorize(actor, storeId)
    return this.uow.run(async tx => {
      const order = await tx.orders.get(storeId, orderId)
      requireRule(order, 'ORDER_NOT_FOUND')
      requireRule(order.storeId === storeId, 'CROSS_STORE_ACCESS')
      if (order.status === 'REVERSED') return order
      requireRule(order.status === 'CONFIRMED', 'INVALID_ORDER_STATE')
      // Restore the actual authoritative debit ledger, never current product prices or an external quantity.
      const debits = (await tx.stockMovements.listByOrder(storeId, orderId)).filter(m => m.type === 'ORDER_CONFIRMED')
      requireRule(debits.length > 0, 'INVALID_STOCK_HISTORY')
      for (const debit of debits) {
        integer(debit.quantity, 1, 'INVALID_STOCK_HISTORY')
        requireRule(debit.previousStock - debit.newStock === debit.quantity, 'INVALID_STOCK_HISTORY')
      }
      const quantities = consolidate(debits)
      requireRule(JSON.stringify(quantities) === JSON.stringify(consolidate(order.items)), 'INVALID_STOCK_HISTORY')
      for (const item of quantities) {
        const product = await tx.products.get(storeId, item.productId)
        requireRule(product, 'PRODUCT_NOT_FOUND')
        requireRule(product.storeId === storeId, 'CROSS_STORE_ACCESS')
        await recordStockChange(tx, this.runtime, product, { type: 'ORDER_REVERSED', quantity: item.quantity,
          actorId, reason: 'Order fully reversed', orderId, idempotencyKey: JSON.stringify(['reverse', orderId, product.id]) })
      }
      const updated: Order = { ...order, status: 'REVERSED', reversedAt: this.runtime.now(), reversedBy: actorId }
      await tx.orders.update(storeId, updated)
      return updated
    })
  }
}
