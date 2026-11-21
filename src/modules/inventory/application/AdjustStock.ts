import { authorize, type ActorContext } from '../../../shared/domain/ActorContext'
import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'
import { operationalStore } from '../../commerce/application/policies'
import type { Runtime, UnitOfWork } from '../../commerce/application/UnitOfWork'
import type { StockMovement } from '../domain/StockMovement'
import { recordStockChange } from './recordStockChange'

export class AdjustStock {
  constructor(private uow: UnitOfWork, private runtime: Runtime) {}
  execute(actor: ActorContext, input: { storeId: string; productId: string; type: 'MANUAL_ENTRY' | 'MANUAL_EXIT';
    quantity: number; reason: string; idempotencyKey: string }): Promise<StockMovement> {
    input = { ...input }
    const actorId = authorize(actor, input.storeId)
    requireRule(['MANUAL_ENTRY', 'MANUAL_EXIT'].includes(input.type), 'INVALID_INPUT')
    integer(input.quantity, 1, 'INVALID_QUANTITY')
    const reason = nonempty(input.reason)
    const key = JSON.stringify(['adjust', nonempty(input.idempotencyKey)])
    return this.uow.run(async tx => {
      await operationalStore(tx, input.storeId)
      const previous = await tx.stockMovements.findByIdempotencyKey(input.storeId, key)
      if (previous) {
        requireRule(previous.productId === input.productId && previous.quantity === input.quantity &&
          previous.type === input.type && previous.reason === reason && previous.createdBy === actorId, 'IDEMPOTENCY_CONFLICT')
        return previous
      }
      const product = await tx.products.get(input.storeId, input.productId)
      requireRule(product, 'PRODUCT_NOT_FOUND')
      requireRule(product.storeId === input.storeId, 'CROSS_STORE_ACCESS')
      return recordStockChange(tx, this.runtime, product, { ...input, actorId, reason, idempotencyKey: key })
    })
  }
}
