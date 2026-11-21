import { authorize, type ActorContext } from '../../../shared/domain/ActorContext'
import { nonempty, requireRule } from '../../../shared/domain/DomainError'
import { activeCategory, storePlan } from '../../commerce/application/policies'
import type { Runtime } from '../../commerce/application/UnitOfWork'
import type { CatalogUnitOfWork as UnitOfWork } from '../../commerce/application/CatalogUnitOfWork'
import { validateProduct, type Product, type ProductStatus } from '../domain/Product'

interface ProductInput { storeId: string; name: string; description: string; priceCents: number; categoryId: string }
export class ManageProducts {
  constructor(private uow: UnitOfWork, private runtime: Runtime) {}
  /** Initial stock is always zero. Entry stock must go through AdjustStock. */
  create(actor: ActorContext, input: ProductInput): Promise<Product> {
    input = { ...input }
    authorize(actor, input.storeId)
    return this.uow.run(async tx => {
      const plan = await storePlan(tx, input.storeId)
      await activeCategory(tx, input.storeId, input.categoryId)
      const products = await tx.products.list(input.storeId)
      requireRule(products.filter(p => p.status !== 'ARCHIVED').length < plan.limits.maxProducts, 'PRODUCT_LIMIT_REACHED')
      const now = this.runtime.now()
      const product: Product = { id: this.runtime.nextId(), storeId: input.storeId, name: nonempty(input.name),
        description: input.description, priceCents: input.priceCents, categoryId: input.categoryId,
        stock: 0, status: 'ACTIVE', createdAt: now, updatedAt: now }
      validateProduct(product)
      await tx.products.insert(product)
      return product
    })
  }
  update(actor: ActorContext, storeId: string, id: string,
    changes: { name?: string; description?: string; priceCents?: number; categoryId?: string; status?: ProductStatus }): Promise<Product> {
    changes = { ...changes }
    authorize(actor, storeId)
    return this.uow.run(async tx => {
      const plan = await storePlan(tx, storeId)
      const product = await tx.products.get(storeId, id)
      requireRule(product, 'PRODUCT_NOT_FOUND')
      requireRule(product.storeId === storeId, 'CROSS_STORE_ACCESS')
      const updated: Product = { ...product,
        name: nonempty(changes.name ?? product.name), description: changes.description ?? product.description,
        priceCents: changes.priceCents ?? product.priceCents, categoryId: changes.categoryId ?? product.categoryId,
        status: changes.status ?? product.status, updatedAt: this.runtime.now() }
      validateProduct(updated)
      if (updated.status !== 'ARCHIVED' || updated.categoryId !== product.categoryId) {
        await activeCategory(tx, storeId, updated.categoryId)
      }
      if (product.status === 'ARCHIVED' && updated.status !== 'ARCHIVED') {
        const products = await tx.products.list(storeId)
        requireRule(products.filter(p => p.status !== 'ARCHIVED').length < plan.limits.maxProducts, 'PRODUCT_LIMIT_REACHED')
      }
      await tx.products.update(storeId, updated)
      return updated
    })
  }
}
