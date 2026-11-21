import { authorize, type ActorContext } from '../../../shared/domain/ActorContext'
import { requireRule } from '../../../shared/domain/DomainError'
import type { Runtime, UnitOfWork } from '../../commerce/application/UnitOfWork'
import type { Order } from '../domain/Order'

export class CancelPendingOrder {
  constructor(private uow: UnitOfWork, private runtime: Runtime) {}
  execute(actor: ActorContext, storeId: string, orderId: string): Promise<Order> {
    const actorId = authorize(actor, storeId)
    return this.uow.run(async tx => {
      const order = await tx.orders.get(storeId, orderId)
      requireRule(order, 'ORDER_NOT_FOUND')
      requireRule(order.storeId === storeId, 'CROSS_STORE_ACCESS')
      requireRule(order.status === 'PENDING', 'INVALID_ORDER_STATE')
      const updated: Order = { ...order, status: 'CANCELLED', cancelledAt: this.runtime.now(), cancelledBy: actorId }
      await tx.orders.update(storeId, updated)
      return updated
    })
  }
}
