import type { StoreRepository } from '../../stores/application/StoreRepository'
import type { PlanRepository } from '../../plans/application/PlanRepository'
import type { ProductRepository } from '../../products/application/ProductRepository'
import type { CategoryRepository } from '../../categories/application/CategoryRepository'
import type { OrderRepository } from '../../orders/application/OrderRepository'
import type { StockMovementRepository } from '../../inventory/application/StockMovementRepository'

export interface Transaction {
  stores: StoreRepository
  plans: PlanRepository
  products: ProductRepository
  categories: CategoryRepository
  orders: OrderRepository
  stockMovements: StockMovementRepository
}
/** Serializable, all-or-nothing; transaction-scoped ports cannot escape the callback.
 * Future adapters must include quota/idempotency reads in the same transaction,
 * retry serialization conflicts, and never split orders from inventory.
 */
export interface UnitOfWork {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>
}
export interface Runtime { now(): string; nextId(): string }
