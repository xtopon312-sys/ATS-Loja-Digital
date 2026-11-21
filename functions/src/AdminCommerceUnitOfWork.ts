import type { DocumentData, Firestore, Transaction as FirestoreTransaction } from 'firebase-admin/firestore'
import type { Transaction, UnitOfWork } from '../../src/modules/commerce/application/UnitOfWork'
import type { Store } from '../../src/modules/stores/domain/Store'
import type { Product } from '../../src/modules/products/domain/Product'
import { integer, requireRule } from '../../src/shared/domain/DomainError'
import { publicProduct } from '../../src/infrastructure/firebase/catalog/publicProjection'
import { date, id, productDto, timestamps } from './dto'
import { FirestoreOrderRepository, FirestoreStockMovementRepository } from './repositories'

/** One privileged command = one real Firestore transaction; writes are buffered until every read completes. */
export class AdminCommerceUnitOfWork implements UnitOfWork {
  constructor(private db: Firestore, private transaction: FirestoreTransaction, private storeId: string,
    private rawStore: DocumentData, private fault?: (stage: 'products' | 'movements' | 'orders') => void) {}
  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    let open = true
    const scope = (storeId: string) => { requireRule(open, 'TRANSACTION_CLOSED'); requireRule(storeId === this.storeId, 'CROSS_STORE_ACCESS') }
    const unavailable = async (): Promise<never> => { throw new Error('Operation outside the privileged command contract') }
    const original = new Map<string, { product: Product }>()
    const pending = new Map<string, Product>()
    const orders = new FirestoreOrderRepository(this.db, this.transaction, this.storeId)
    const movements = new FirestoreStockMovementRepository(this.db, this.transaction, this.storeId)
    const getProduct = async (storeId: string, productId: string) => {
      scope(storeId)
      if (pending.has(productId)) return structuredClone(pending.get(productId))
      if (!original.has(productId)) {
        const doc = await this.transaction.get(this.db.doc(`stores/${storeId}/products/${id(productId)}`))
        if (!doc.exists) return undefined
        original.set(productId, { product: productDto(doc.data(), storeId, productId) })
      }
      return structuredClone(original.get(productId)!.product)
    }
    const store: Store = { id: this.storeId, slug: this.rawStore.slug, name: this.rawStore.name, status: this.rawStore.status,
      planId: this.rawStore.planId, billingStatus: this.rawStore.billingStatus,
      createdAt: date(this.rawStore.createdAt), updatedAt: date(this.rawStore.updatedAt) }
    const tx: Transaction = {
      stores: { get: async storeId => { scope(storeId); return structuredClone(store) }, insert: unavailable },
      plans: { get: unavailable }, categories: { get: unavailable, list: unavailable, insert: unavailable, update: unavailable },
      products: { get: getProduct, list: unavailable, insert: unavailable, update: async (storeId, product) => {
        scope(storeId)
        const before = await getProduct(storeId, product.id)
        requireRule(before, 'PRODUCT_NOT_FOUND')
        for (const key of ['id', 'storeId', 'name', 'description', 'priceCents', 'categoryId', 'status', 'createdAt'] as const) {
          requireRule(before[key] === product[key], 'INVALID_INPUT')
        }
        pending.set(product.id, productDto(product, storeId, product.id))
      } }, orders, stockMovements: movements,
    }
    try {
      const result = await work(tx)
      for (const movement of movements.pending) requireRule(pending.has(movement.productId), 'INVALID_STOCK_HISTORY')
      for (const product of pending.values()) {
        let stock = original.get(product.id)!.product.stock
        for (const movement of movements.pending.filter(row => row.productId === product.id)) {
          requireRule(movement.previousStock === stock, 'INVALID_STOCK_HISTORY'); stock = movement.newStock
        }
        requireRule(stock === product.stock, 'INVALID_STOCK_HISTORY')
      }
      if (pending.size) {
        const revision = integer(this.rawStore.usage?.revision + 1, 1, 'INVALID_INPUT')
        this.transaction.update(this.db.doc(`stores/${this.storeId}`), { 'usage.revision': revision })
        for (const product of pending.values()) {
          // Preserve the original Firestore timestamp precision and all physical fields unrelated to stock.
          this.transaction.update(this.db.doc(`stores/${this.storeId}/products/${product.id}`),
            { stock: product.stock, updatedAt: timestamps(product).updatedAt, catalogRevision: revision })
          if (this.rawStore.publicCatalogEnabled === true) this.transaction.set(this.db.doc(`publicStores/${this.storeId}/products/${product.id}`), publicProduct(product))
        }
      }
      this.fault?.('products')
      movements.flush(); this.fault?.('movements')
      orders.flush(); this.fault?.('orders')
      return structuredClone(result)
    } finally { open = false }
  }
}
