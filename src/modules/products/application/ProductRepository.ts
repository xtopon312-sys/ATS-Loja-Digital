import type { Product } from '../domain/Product'
export interface ProductRepository {
  get(storeId: string, id: string): Promise<Product | undefined>
  list(storeId: string): Promise<Product[]>
  insert(product: Product): Promise<void>
  /** Scope is immutable. No physical delete; stock writes require a movement in the same unit. */
  update(storeId: string, product: Product): Promise<void>
}
