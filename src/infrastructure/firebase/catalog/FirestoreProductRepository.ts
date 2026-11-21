import type { ProductRepository } from '../../../modules/products/application/ProductRepository'
import type { Product } from '../../../modules/products/domain/Product'
import { requireRule } from '../../../shared/domain/DomainError'
import { copy, productFromDto } from './catalogDto'

/** Transaction-scoped defensive buffer. Only FirestoreCatalogUnitOfWork commits it. */
export class FirestoreProductRepository implements ProductRepository {
  constructor(private storeId: string, private rows: Map<string, Product>, private writes: Set<string>, private guard: () => void) {}
  private scope(storeId: string) { this.guard(); requireRule(storeId === this.storeId, 'CROSS_STORE_ACCESS') }
  async get(storeId: string, id: string) { this.scope(storeId); return copy(this.rows.get(id)) }
  async list(storeId: string) { this.scope(storeId); return copy([...this.rows.values()]) }
  async insert(product: Product) {
    this.scope(product.storeId)
    requireRule(!this.rows.has(product.id), 'DUPLICATE_ID')
    const value = productFromDto(product.id, this.storeId, product)
    this.rows.set(value.id, value); this.writes.add(value.id)
  }
  async update(storeId: string, product: Product) {
    this.scope(storeId)
    const original = this.rows.get(product.id)
    requireRule(original, 'PRODUCT_NOT_FOUND')
    requireRule(product.createdAt === original.createdAt, 'INVALID_INPUT')
    const value = productFromDto(product.id, this.storeId, product)
    this.rows.set(value.id, value); this.writes.add(value.id)
  }
}
