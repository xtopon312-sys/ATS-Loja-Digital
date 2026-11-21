import { authorize, type ActorContext } from '../../../shared/domain/ActorContext'
import { integer, requireRule } from '../../../shared/domain/DomainError'
import type { CatalogUnitOfWork } from '../../commerce/application/CatalogUnitOfWork'
import type { Runtime } from '../../commerce/application/UnitOfWork'
import { recordStockChange } from '../../inventory/application/recordStockChange'
import { ManageProducts } from './ManageProducts'

export interface RegisterProductInput {
  storeId: string; name: string; description: string; priceCents: number; categoryId: string
  initialStock: number; status: 'ACTIVE' | 'INACTIVE'
}
/** Composes existing domain commands in one unit; never a create then independent stock write. */
export class RegisterProduct {
  constructor(private uow: CatalogUnitOfWork, private runtime: Runtime) {}
  execute(actor: ActorContext, input: RegisterProductInput) {
    const value = { ...input }
    authorize(actor, value.storeId)
    requireRule(actor.role !== 'PUBLIC', 'ACCESS_DENIED')
    integer(value.initialStock, 0, 'INVALID_STOCK')
    requireRule(['ACTIVE', 'INACTIVE'].includes(value.status), 'INVALID_INPUT')
    return this.uow.run(async tx => {
      const commands = new ManageProducts({ run: work => work(tx) }, this.runtime)
      let product = await commands.create(actor, value)
      if (value.status === 'INACTIVE') product = await commands.update(actor, value.storeId, product.id, { status: value.status })
      if (value.initialStock > 0) {
        await recordStockChange(tx, { ...this.runtime, now: () => this.runtime.now(), nextId: () => product.id }, product, {
          type: 'MANUAL_ENTRY', quantity: value.initialStock, actorId: actor.actorId,
          reason: 'Estoque inicial', idempotencyKey: `initial:${product.id}`,
        })
      }
      return (await tx.products.get(value.storeId, product.id))!
    })
  }
}
