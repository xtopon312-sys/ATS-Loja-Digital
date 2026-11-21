import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'
import type { Category } from '../../categories/domain/Category'
import type { StockMovement } from '../../inventory/domain/StockMovement'
import type { Order } from '../../orders/domain/Order'
import { INITIAL_PLAN, type Plan } from '../../plans/domain/Plan'
import { validateProduct, type Product } from '../../products/domain/Product'
import { normalizeSlug, type Store } from '../../stores/domain/Store'
import type { Transaction, UnitOfWork } from '../application/UnitOfWork'

interface State {
  stores: Store[]
  plans: Plan[]
  categories: Category[]
  products: Product[]
  orders: Order[]
  movements: StockMovement[]
}

// All persistence records are JSON values (timestamps are strings). No live references leave this adapter.
function copy<T>(value: T): T { return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T }

/** Test-only adapter. Serializes ALL transactions within ONE instance, including reads.
 * No cross-process durability, distributed lock, external service or production fallback.
 * Constructor seeds are trusted test arrangement, not application commands.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private state: State
  private tail: Promise<void> = Promise.resolve()

  constructor(seed: Partial<State> = {}) {
    this.state = copy({ stores: [], plans: [INITIAL_PLAN], categories: [], products: [], orders: [], movements: [], ...seed })
    for (const product of this.state.products) validateProduct(product)
    for (const table of [this.state.products, this.state.categories, this.state.orders, this.state.movements]) {
      const keys = table.map(row => JSON.stringify([row.storeId, row.id]))
      requireRule(new Set(keys).size === keys.length, 'DUPLICATE_ID')
    }
    const stores = this.state.stores
    requireRule(new Set(stores.map(s => s.id)).size === stores.length, 'DUPLICATE_ID')
    for (const store of stores) store.slug = normalizeSlug(store.slug)
    requireRule(new Set(stores.map(s => s.slug)).size === stores.length, 'SLUG_IN_USE')
  }

  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const before = this.tail
    let release!: () => void
    this.tail = new Promise<void>(resolve => { release = resolve })
    await before
    const draft = copy(this.state)
    let open = true
    const guard = () => requireRule(open, 'TRANSACTION_CLOSED')
    const scope = (storeId: string, row: { storeId: string }) => {
      guard()
      requireRule(row.storeId === storeId, 'CROSS_STORE_ACCESS')
    }
    const tx: Transaction = {
      stores: {
        get: async id => { guard(); return copy(draft.stores.find(s => s.id === id)) },
        insert: async store => {
          guard()
          const row = copy(store)
          row.slug = normalizeSlug(row.slug)
          requireRule(!draft.stores.some(s => s.id === row.id), 'DUPLICATE_ID')
          requireRule(!draft.stores.some(s => s.slug === row.slug), 'SLUG_IN_USE')
          draft.stores.push(row)
        },
      },
      plans: { get: async id => { guard(); return copy(draft.plans.find(p => p.id === id)) } },
      products: {
        get: async (storeId, id) => { guard(); return copy(draft.products.find(p => p.storeId === storeId && p.id === id)) },
        list: async storeId => { guard(); return copy(draft.products.filter(p => p.storeId === storeId)) },
        insert: async product => {
          guard(); validateProduct(product)
          requireRule(!draft.products.some(p => p.storeId === product.storeId && p.id === product.id), 'DUPLICATE_ID')
          draft.products.push(copy(product))
        },
        update: async (storeId, product) => {
          scope(storeId, product); validateProduct(product)
          const index = draft.products.findIndex(p => p.storeId === storeId && p.id === product.id)
          requireRule(index >= 0, 'PRODUCT_NOT_FOUND')
          draft.products[index] = copy(product)
        },
      },
      categories: {
        get: async (storeId, id) => { guard(); return copy(draft.categories.find(c => c.storeId === storeId && c.id === id)) },
        list: async storeId => { guard(); return copy(draft.categories.filter(c => c.storeId === storeId)) },
        insert: async category => {
          guard()
          requireRule(!draft.categories.some(c => c.storeId === category.storeId && c.id === category.id), 'DUPLICATE_ID')
          draft.categories.push(copy(category))
        },
        update: async (storeId, category) => {
          scope(storeId, category)
          const index = draft.categories.findIndex(c => c.storeId === storeId && c.id === category.id)
          requireRule(index >= 0, 'CATEGORY_NOT_FOUND')
          draft.categories[index] = copy(category)
        },
      },
      orders: {
        get: async (storeId, id) => { guard(); return copy(draft.orders.find(o => o.storeId === storeId && o.id === id)) },
        findByIdempotencyKey: async (storeId, key) => { guard(); return copy(draft.orders.find(o => o.storeId === storeId && o.idempotencyKey === key)) },
        insert: async order => {
          guard()
          requireRule(!draft.orders.some(o => o.storeId === order.storeId && o.id === order.id), 'DUPLICATE_ID')
          requireRule(!draft.orders.some(o => o.storeId === order.storeId && o.idempotencyKey === order.idempotencyKey), 'IDEMPOTENCY_CONFLICT')
          draft.orders.push(copy(order))
        },
        update: async (storeId, order) => {
          scope(storeId, order)
          const index = draft.orders.findIndex(o => o.storeId === storeId && o.id === order.id)
          requireRule(index >= 0, 'ORDER_NOT_FOUND')
          const original = draft.orders[index]
          for (const key of ['items', 'customer', 'totalCents', 'createdAt', 'idempotencyKey', 'requestFingerprint'] as const) {
            requireRule(JSON.stringify(original[key]) === JSON.stringify(order[key]), 'INVALID_INPUT')
          }
          draft.orders[index] = copy(order)
        },
      },
      stockMovements: {
        listByOrder: async (storeId, orderId) => { guard(); return copy(draft.movements.filter(m => m.storeId === storeId && m.orderId === orderId)) },
        findByIdempotencyKey: async (storeId, key) => { guard(); return copy(draft.movements.find(m => m.storeId === storeId && m.idempotencyKey === key)) },
        list: async storeId => { guard(); return copy(draft.movements.filter(m => m.storeId === storeId)) },
        append: async movement => {
          guard()
          integer(movement.quantity, 1, 'INVALID_QUANTITY')
          integer(movement.previousStock, 0, 'INVALID_STOCK')
          integer(movement.newStock, 0, 'INVALID_STOCK')
          nonempty(movement.idempotencyKey)
          requireRule(!draft.movements.some(m => m.storeId === movement.storeId && m.id === movement.id), 'DUPLICATE_ID')
          requireRule(!draft.movements.some(m => m.storeId === movement.storeId && m.idempotencyKey === movement.idempotencyKey), 'IDEMPOTENCY_CONFLICT')
          draft.movements.push(copy(movement))
        },
      },
    }
    try {
      const result = await work(tx)
      this.validateLedger(draft)
      const detached = copy(result)
      this.state = draft
      return detached
    } finally {
      open = false
      release()
    }
  }

  private validateLedger(draft: State): void {
    const appended = draft.movements.slice(this.state.movements.length)
    for (const movement of appended) {
      requireRule(draft.products.some(p => p.storeId === movement.storeId && p.id === movement.productId), 'PRODUCT_NOT_FOUND')
    }
    for (const product of draft.products) {
      let stock = this.state.products.find(p => p.storeId === product.storeId && p.id === product.id)?.stock ?? 0
      for (const movement of appended.filter(m => m.storeId === product.storeId && m.productId === product.id)) {
        requireRule(['MANUAL_ENTRY', 'MANUAL_EXIT', 'ORDER_CONFIRMED', 'ORDER_REVERSED'].includes(movement.type), 'INVALID_STOCK_HISTORY')
        const entering = movement.type === 'MANUAL_ENTRY' || movement.type === 'ORDER_REVERSED'
        requireRule(movement.previousStock === stock && movement.newStock === stock + (entering ? movement.quantity : -movement.quantity), 'INVALID_STOCK_HISTORY')
        stock = movement.newStock
      }
      requireRule(stock === product.stock, 'INVALID_STOCK_HISTORY')
    }
  }
}
