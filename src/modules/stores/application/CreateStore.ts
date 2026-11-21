import { authorize, type ActorContext } from '../../../shared/domain/ActorContext'
import { nonempty, requireRule } from '../../../shared/domain/DomainError'
import type { Runtime, UnitOfWork } from '../../commerce/application/UnitOfWork'
import { INITIAL_PLAN } from '../../plans/domain/Plan'
import { normalizeSlug, type Store } from '../domain/Store'

export class CreateStore {
  constructor(private uow: UnitOfWork, private runtime: Runtime) {}
  execute(actor: ActorContext, input: { slug: string; name: string }): Promise<Store> {
    input = { ...input }
    requireRule(actor.role === 'MASTER', 'ACCESS_DENIED')
    authorize(actor, '')
    return this.uow.run(async tx => {
      requireRule(await tx.plans.get(INITIAL_PLAN.id), 'PLAN_NOT_FOUND')
      const now = this.runtime.now()
      const store: Store = { id: this.runtime.nextId(), slug: normalizeSlug(input.slug), name: nonempty(input.name),
        status: 'ACTIVE', billingStatus: 'PENDING', planId: INITIAL_PLAN.id, createdAt: now, updatedAt: now }
      await tx.stores.insert(store)
      return store
    })
  }
}
