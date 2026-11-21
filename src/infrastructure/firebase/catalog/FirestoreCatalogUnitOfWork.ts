import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { normalizedPhone } from '../../../modules/orders/application/Checkout'
import { publicCategory, publicProduct } from './publicProjection'
import type { CatalogTransaction, CatalogUnitOfWork } from '../../../modules/commerce/application/CatalogUnitOfWork'
import type { StockMovement } from '../../../modules/inventory/domain/StockMovement'
import { INITIAL_PLAN } from '../../../modules/plans/domain/Plan'
import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'
import { categoryFromDto, copy, documentId, productFromDto, storeFromDto } from './catalogDto'
import { FirestoreCategoryRepository } from './FirestoreCategoryRepository'
import { FirestoreProductRepository } from './FirestoreProductRepository'

class SnapshotChanged extends Error {}
const counted = (rows: { status: string }[]) => rows.filter(p => p.status !== 'ARCHIVED').length

export class FirestoreCatalogUnitOfWork implements CatalogUnitOfWork {
  constructor(private db: Firestore, private storeId: string, private onRetry: () => void = () => {}) { documentId(storeId) }

  async renameStore(name: string, whatsapp?: string): Promise<void> {
    const value = nonempty(name)
    const phone = whatsapp === undefined ? {} : { whatsapp: whatsapp.trim() ? normalizedPhone(whatsapp) : '' }
    requireRule(value.length <= 120, 'INVALID_INPUT')
    await runTransaction(this.db, async tx => {
      const ref = doc(this.db, 'stores', this.storeId), current = await tx.get(ref)
      requireRule(current.exists(), 'STORE_NOT_FOUND')
      tx.update(ref, { name: value, ...phone, updatedAt: serverTimestamp() })
      if (current.data().publicCatalogEnabled === true) tx.update(doc(this.db, 'publicStores', this.storeId), { name: value, ...phone })
    })
  }

  async run<T>(work: (ports: CatalogTransaction) => Promise<T>): Promise<T> {
    const storeRef = doc(this.db, 'stores', this.storeId)
    for (let attempt = 0; attempt < 12; attempt++) {
      const before = await getDocFromServer(storeRef)
      requireRule(before.exists(), 'STORE_NOT_FOUND')
      const revision = integer(before.data().usage?.revision, 0, 'INVALID_INPUT')
      const [productDocs, categoryDocs] = await Promise.all([
        getDocsFromServer(collection(storeRef, 'products')), getDocsFromServer(collection(storeRef, 'categories')),
      ])
      try {
        return await runTransaction(this.db, async transaction => {
          const current = await transaction.get(storeRef)
          requireRule(current.exists(), 'STORE_NOT_FOUND')
          if (current.data().usage?.revision !== revision) throw new SnapshotChanged()
          const store = storeFromDto(this.storeId, current.data())
          const products = new Map(productDocs.docs.map(d => [d.id, productFromDto(d.id, this.storeId, d.data())]))
          const categories = new Map(categoryDocs.docs.map(d => [d.id, categoryFromDto(d.id, this.storeId, d.data())]))
          const originals = new Map(products)
          const categoryOriginals = new Map(categories)
          requireRule(counted([...products.values()]) === current.data().usage.productCount && counted([...categories.values()]) === current.data().usage.categoryCount, 'INVALID_INPUT')
          for (const d of categoryDocs.docs) requireRule(d.data().productCount === [...products.values()].filter(p => p.categoryId === d.id && p.status !== 'ARCHIVED').length, 'INVALID_INPUT')
          const productWrites = new Set<string>(), categoryWrites = new Set<string>(), movements: StockMovement[] = []
          let open = true
          const guard = () => requireRule(open, 'TRANSACTION_CLOSED')
          const ports: CatalogTransaction = {
            stores: { get: async id => { guard(); requireRule(id === this.storeId, 'CROSS_STORE_ACCESS'); return copy(store) } },
            plans: { get: async id => { guard(); return id === INITIAL_PLAN.id ? copy(INITIAL_PLAN) : undefined } },
            products: new FirestoreProductRepository(this.storeId, products, productWrites, guard),
            categories: new FirestoreCategoryRepository(this.storeId, categories, categoryWrites, guard),
            stockMovements: { append: async movement => { guard(); movements.push(copy(movement)) } },
          }
          try {
            const result = copy(await work(ports))
            if (!productWrites.size && !categoryWrites.size) { requireRule(!movements.length, 'INVALID_STOCK_HISTORY'); return result }
            requireRule(productWrites.size + categoryWrites.size === 1, 'INVALID_INPUT')
            const kind = productWrites.size ? 'PRODUCT' : 'CATEGORY'
            const id = [...productWrites, ...categoryWrites][0]
            for (const productId of productWrites) {
              const product = products.get(productId)!, original = originals.get(productId)
              const initial = movements.filter(m => m.productId === productId)
              if (original) requireRule(product.stock === original.stock && !initial.length, 'INVALID_STOCK_HISTORY')
              else if (product.stock > 0) {
                requireRule(initial.length === 1 && initial[0].id === productId && initial[0].storeId === this.storeId && initial[0].type === 'MANUAL_ENTRY' && initial[0].previousStock === 0 && initial[0].quantity === product.stock && initial[0].newStock === product.stock, 'INVALID_STOCK_HISTORY')
              } else requireRule(!initial.length, 'INVALID_STOCK_HISTORY')
              transaction.set(doc(storeRef, 'products', productId), { ...product, catalogRevision: revision + 1, createdAt: original ? productDocs.docs.find(d => d.id === productId)!.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() })
              if (current.data().publicCatalogEnabled === true) transaction.set(doc(this.db, 'publicStores', this.storeId, 'products', productId), publicProduct(product))
            }
            requireRule(movements.every(m => productWrites.has(m.productId)), 'INVALID_STOCK_HISTORY')
            for (const category of categories.values()) {
              const productCount = [...products.values()].filter(p => p.categoryId === category.id && p.status !== 'ARCHIVED').length
              const previousCount = [...originals.values()].filter(p => p.categoryId === category.id && p.status !== 'ARCHIVED').length
              if (categoryWrites.has(category.id) || productCount !== previousCount) {
                const original = categoryOriginals.get(category.id)
                transaction.set(doc(storeRef, 'categories', category.id), { ...category, productCount, catalogRevision: revision + 1,
                  createdAt: original ? categoryDocs.docs.find(d => d.id === category.id)!.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() })
                if (current.data().publicCatalogEnabled === true) transaction.set(doc(this.db, 'publicStores', this.storeId, 'categories', category.id), publicCategory(category))
              }
            }
            for (const movement of movements) transaction.set(doc(storeRef, 'stockMovements', movement.id), { ...movement, createdAt: serverTimestamp() })
            transaction.update(storeRef, { usage: { productCount: counted([...products.values()]), categoryCount: counted([...categories.values()]), revision: revision + 1 }, catalogMutation: { kind, id } })
            return result
          } finally { open = false }
        })
      } catch (error) {
        // Rules may reject a stale revision before Firestore returns ABORTED. Retry only
        // after an authorized server read proves that another catalog commit occurred.
        const denied = typeof error === 'object' && error !== null && 'code' in error && error.code === 'permission-denied'
        if (!(error instanceof SnapshotChanged)) {
          if (!denied) throw error
          const latest = await getDocFromServer(storeRef)
          if (!latest.exists() || latest.data().usage?.revision === revision) throw error
        }
        this.onRetry()
      }
    }
    throw new Error('CATALOG_CONFLICT: tente novamente')
  }
}
