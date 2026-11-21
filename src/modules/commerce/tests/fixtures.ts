import type { ActorContext } from '../../../shared/domain/ActorContext'
import { ManageCategories } from '../../categories/application/ManageCategories'
import type { Category } from '../../categories/domain/Category'
import { AdjustStock } from '../../inventory/application/AdjustStock'
import { CancelPendingOrder } from '../../orders/application/CancelPendingOrder'
import { ConfirmOrder } from '../../orders/application/ConfirmOrder'
import { CreatePendingOrder } from '../../orders/application/CreatePendingOrder'
import { ReverseConfirmedOrder } from '../../orders/application/ReverseConfirmedOrder'
import { INITIAL_PLAN } from '../../plans/domain/Plan'
import { ManageProducts } from '../../products/application/ManageProducts'
import type { Product } from '../../products/domain/Product'
import { CreateStore } from '../../stores/application/CreateStore'
import type { Store } from '../../stores/domain/Store'
import { InMemoryUnitOfWork } from '../adapters/InMemoryUnitOfWork'
import type { Runtime, UnitOfWork } from '../application/UnitOfWork'

export const now = '2026-09-04T12:00:00.000Z'
export const master: ActorContext = { role: 'MASTER', actorId: 'master-test' }
export const merchant: ActorContext = { role: 'MERCHANT', actorId: 'merchant-test', storeId: 'a' }
export const publicActor: ActorContext = { role: 'PUBLIC' }
export const store = (id = 'a'): Store => ({ id, slug: `store-${id}`, name: `Store ${id}`, status: 'ACTIVE',
  planId: INITIAL_PLAN.id, billingStatus: 'PENDING', createdAt: now, updatedAt: now })
export const category = (id = 'c', storeId = 'a'): Category => ({ id, storeId, name: `Category ${id}`, status: 'ACTIVE', createdAt: now, updatedAt: now })
export const product = (id = 'p', stock = 0, storeId = 'a'): Product => ({ id, storeId, name: `Product ${id}`,
  description: '', categoryId: 'c', priceCents: 1250, stock, status: 'ACTIVE', createdAt: now, updatedAt: now })
export const productInput = { storeId: 'a', name: 'Test product', description: '', priceCents: 250, categoryId: 'c' }
export const orderInput = (key = 'request-1', productId = 'p', quantity = 1, storeId = 'a') => ({ storeId,
  items: [{ productId, quantity }], customer: { name: 'Test customer' }, idempotencyKey: key })

export function fixture(products = [product('p', 5)], extra: ConstructorParameters<typeof InMemoryUnitOfWork>[0] = {}) {
  let sequence = 0
  const runtime: Runtime = { now: () => now, nextId: () => `generated-${++sequence}` }
  const db = new InMemoryUnitOfWork({ stores: [store(), store('b')], categories: [category(), category('c', 'b')], products, ...extra })
  return { db, runtime, ...commands(db, runtime),
    readProduct: (id = 'p', storeId = 'a') => db.run(tx => tx.products.get(storeId, id)),
    readOrder: (id: string, storeId = 'a') => db.run(tx => tx.orders.get(storeId, id)),
    movements: (storeId = 'a') => db.run(tx => tx.stockMovements.list(storeId)),
  }
}

export function commands(db: UnitOfWork, runtime: Runtime) {
  return { products: new ManageProducts(db, runtime), categories: new ManageCategories(db, runtime),
    stores: new CreateStore(db, runtime), adjust: new AdjustStock(db, runtime), create: new CreatePendingOrder(db, runtime),
    confirm: new ConfirmOrder(db, runtime), cancel: new CancelPendingOrder(db, runtime), reverse: new ReverseConfirmedOrder(db, runtime) }
}
