import type { ActorContext } from '../../../shared/domain/ActorContext'
import { authorize } from '../../../shared/domain/ActorContext'
import { nonempty, requireRule } from '../../../shared/domain/DomainError'
import type { CatalogUnitOfWork } from '../../commerce/application/CatalogUnitOfWork'
import type { Runtime } from '../../commerce/application/UnitOfWork'
import { ManageProducts } from '../../products/application/ManageProducts'
import { RegisterProduct } from '../../products/application/RegisterProduct'
import { ManageCategories } from '../../categories/application/ManageCategories'
import type { Product, ProductStatus } from '../../products/domain/Product'
import type { Category } from '../../categories/domain/Category'
import type { Store } from '../../stores/domain/Store'
import { parseBRLCents } from './money'

export interface CatalogView {
  store: Store; products: Product[]; categories: Category[]; limits: { maxProducts: number; maxCategories: number }
  summary: { productsUsed: number; categoriesUsed: number; activeProducts: number; inactiveProducts: number }
  canCreateProduct: boolean; canCreateCategory: boolean
}
export interface ProductFormValue { name: string; description: string; price: string; categoryId: string; initialStock: string; status: ProductStatus }
export interface StoreDetailsWriter { renameStore(name: string, whatsapp?: string): Promise<void> }
export interface MerchantGateway {
  load(actor: ActorContext): Promise<CatalogView>
  saveProduct(actor: ActorContext, value: ProductFormValue, id?: string): Promise<Product>
  productStatus(actor: ActorContext, id: string, status: ProductStatus): Promise<Product>
  saveCategory(actor: ActorContext, name: string, id?: string): Promise<Category>
  categoryStatus(actor: ActorContext, id: string, status: Category['status']): Promise<Category>
  renameStore(actor: ActorContext, name: string, whatsapp?: string): Promise<void>
}
export class MerchantApplication implements MerchantGateway {
  constructor(private uowFor: (storeId: string) => CatalogUnitOfWork & StoreDetailsWriter, private runtime: Runtime) {}
  private scope(actor: ActorContext) { requireRule(actor.role === 'MERCHANT', 'ACCESS_DENIED'); authorize(actor, actor.storeId); return actor.storeId }
  async load(actor: ActorContext): Promise<CatalogView> {
    const storeId = this.scope(actor)
    return this.uowFor(storeId).run(async tx => {
      const store = await tx.stores.get(storeId)
      requireRule(store, 'STORE_NOT_FOUND')
      const plan = await tx.plans.get(store.planId)
      requireRule(plan, 'PLAN_NOT_FOUND')
      const products = await tx.products.list(storeId), categories = await tx.categories.list(storeId)
      const summary = { productsUsed: products.filter(p => p.status !== 'ARCHIVED').length, categoriesUsed: categories.filter(c => c.status !== 'ARCHIVED').length,
        activeProducts: products.filter(p => p.status === 'ACTIVE').length, inactiveProducts: products.filter(p => p.status === 'INACTIVE').length }
      return { store, products, categories, limits: { ...plan.limits }, summary,
        canCreateProduct: store.status === 'ACTIVE' && summary.productsUsed < plan.limits.maxProducts,
        canCreateCategory: store.status === 'ACTIVE' && summary.categoriesUsed < plan.limits.maxCategories }
    })
  }
  saveProduct(actor: ActorContext, value: ProductFormValue, id?: string) {
    const storeId = this.scope(actor), uow = this.uowFor(storeId)
    const changes = { name: nonempty(value.name), description: value.description, priceCents: parseBRLCents(value.price), categoryId: value.categoryId, status: value.status }
    requireRule(changes.name.length <= 120 && changes.description.length <= 2000, 'INVALID_INPUT')
    if (id) return new ManageProducts(uow, this.runtime).update(actor, storeId, id, changes)
    requireRule(/^\d+$/.test(value.initialStock), 'INVALID_STOCK')
    requireRule(value.status === 'ACTIVE' || value.status === 'INACTIVE', 'INVALID_INPUT')
    return new RegisterProduct(uow, this.runtime).execute(actor, { ...changes, status: value.status, storeId, initialStock: Number(value.initialStock) })
  }
  productStatus(actor: ActorContext, id: string, status: ProductStatus) {
    const storeId = this.scope(actor)
    return new ManageProducts(this.uowFor(storeId), this.runtime).update(actor, storeId, id, { status })
  }
  saveCategory(actor: ActorContext, name: string, id?: string) {
    const storeId = this.scope(actor), commands = new ManageCategories(this.uowFor(storeId), this.runtime)
    requireRule(nonempty(name).length <= 120, 'INVALID_INPUT')
    return id ? commands.rename(actor, storeId, id, name) : commands.create(actor, { storeId, name })
  }
  categoryStatus(actor: ActorContext, id: string, status: Category['status']) {
    const storeId = this.scope(actor)
    return new ManageCategories(this.uowFor(storeId), this.runtime).setStatus(actor, storeId, id, status)
  }
  async renameStore(actor: ActorContext, name: string, whatsapp?: string) { await this.uowFor(this.scope(actor)).renameStore(name, whatsapp) }
}
