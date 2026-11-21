import { authorize, type ActorContext } from '../../../shared/domain/ActorContext'
import { nonempty, requireRule } from '../../../shared/domain/DomainError'
import { storePlan } from '../../commerce/application/policies'
import type { Runtime } from '../../commerce/application/UnitOfWork'
import type { CatalogUnitOfWork as UnitOfWork } from '../../commerce/application/CatalogUnitOfWork'
import type { Category } from '../domain/Category'

export class ManageCategories {
  constructor(private uow: UnitOfWork, private runtime: Runtime) {}
  rename(actor: ActorContext, storeId: string, id: string, name: string): Promise<Category> {
    authorize(actor, storeId)
    const checkedName = nonempty(name)
    return this.uow.run(async tx => {
      await storePlan(tx, storeId)
      const category = await tx.categories.get(storeId, id)
      requireRule(category, 'CATEGORY_NOT_FOUND')
      const updated = { ...category, name: checkedName, updatedAt: this.runtime.now() }
      await tx.categories.update(storeId, updated)
      return updated
    })
  }
  create(actor: ActorContext, input: { storeId: string; name: string }): Promise<Category> {
    input = { ...input }
    authorize(actor, input.storeId)
    return this.uow.run(async tx => {
      const plan = await storePlan(tx, input.storeId)
      const categories = await tx.categories.list(input.storeId)
      requireRule(categories.filter(c => c.status !== 'ARCHIVED').length < plan.limits.maxCategories, 'CATEGORY_LIMIT_REACHED')
      const now = this.runtime.now()
      const category: Category = { id: this.runtime.nextId(), storeId: input.storeId, name: nonempty(input.name),
        status: 'ACTIVE', createdAt: now, updatedAt: now }
      await tx.categories.insert(category)
      return category
    })
  }
  setStatus(actor: ActorContext, storeId: string, id: string, status: Category['status']): Promise<Category> {
    authorize(actor, storeId)
    requireRule(['ACTIVE', 'ARCHIVED'].includes(status), 'INVALID_INPUT')
    return this.uow.run(async tx => {
      const plan = await storePlan(tx, storeId)
      const category = await tx.categories.get(storeId, id)
      requireRule(category, 'CATEGORY_NOT_FOUND')
      requireRule(category.storeId === storeId, 'CROSS_STORE_ACCESS')
      if (category.status === status) return category
      if (status === 'ARCHIVED') {
        const products = await tx.products.list(storeId)
        requireRule(!products.some(p => p.categoryId === id && p.status !== 'ARCHIVED'), 'CATEGORY_IN_USE')
      } else {
        const categories = await tx.categories.list(storeId)
        requireRule(categories.filter(c => c.status !== 'ARCHIVED').length < plan.limits.maxCategories, 'CATEGORY_LIMIT_REACHED')
      }
      const updated = { ...category, status, updatedAt: this.runtime.now() }
      await tx.categories.update(storeId, updated)
      return updated
    })
  }
}
