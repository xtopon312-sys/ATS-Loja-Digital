import { collection, doc, getDocFromServer, getDocsFromServer, query, where, type Firestore } from 'firebase/firestore'
import type { CatalogResult, PublicCatalogRepository, PublicCategory, PublicProduct, PublicStore } from '../../../modules/storefront/domain/PublicCatalog'
import { normalizeSlug } from '../../../modules/stores/domain/Store'
import { isStoreThemeId } from '../../../modules/store-theme/application/StoreThemeEngine'
import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'
import { documentId } from './catalogDto'

const keys = (data: Record<string, unknown>, names: string[]) => requireRule(Object.keys(data).length === names.length && Object.keys(data).every(k => names.includes(k)), 'INVALID_INPUT')
export class FirestorePublicCatalogRepository implements PublicCatalogRepository {
  constructor(private db: Firestore) {}
  async load(value: string): Promise<CatalogResult> {
    let slug: string
    try { slug = normalizeSlug(value) } catch { return { status: 'NOT_FOUND' } }
    try {
      const lookup = await getDocFromServer(doc(this.db, 'publicStoreSlugs', slug))
      if (!lookup.exists()) return { status: 'NOT_FOUND' }
      keys(lookup.data(), ['storeId'])
      const storeId = documentId(lookup.data().storeId), ref = doc(this.db, 'publicStores', storeId)
      const snapshot = await getDocFromServer(ref)
      if (!snapshot.exists()) return { status: 'UNAVAILABLE' }
      const data = snapshot.data()
      keys(data, ['storeId', 'slug', 'name', 'themePreset', 'publishable', ...(data.whatsapp === undefined ? [] : ['whatsapp'])])
      requireRule(data.whatsapp === undefined || typeof data.whatsapp === 'string' && (data.whatsapp === '' || /^[1-9]\d{9,14}$/.test(data.whatsapp)), 'INVALID_INPUT')
      requireRule(data.storeId === storeId && data.slug === slug && data.publishable === true && isStoreThemeId(data.themePreset), 'INVALID_INPUT')
      const store: PublicStore = { storeId, slug, name: nonempty(data.name), themePreset: data.themePreset, publishable: true, ...(data.whatsapp === undefined ? {} : { whatsapp: data.whatsapp }) }
      const [cats, rows] = await Promise.all(['categories', 'products'].map(name => getDocsFromServer(query(collection(ref, name), where('publishable', '==', true)))))
      const categories: PublicCategory[] = cats.docs.map(row => {
        const c = row.data(); keys(c, ['id', 'storeId', 'name', 'publishable'])
        requireRule(c.id === row.id && c.storeId === storeId && c.publishable === true, 'INVALID_INPUT')
        return { id: documentId(row.id), storeId, name: nonempty(c.name), publishable: true }
      })
      const products: PublicProduct[] = rows.docs.map(row => {
        const p = row.data(); keys(p, ['id', 'storeId', 'name', 'description', 'priceCents', 'categoryId', 'publishable', 'available', 'maxQuantity'])
        requireRule(p.id === row.id && p.storeId === storeId && p.publishable === true && typeof p.description === 'string'
          && [0, 1, 2, 5].includes(p.maxQuantity) && p.available === (p.maxQuantity > 0), 'INVALID_INPUT')
        return { id: documentId(row.id), storeId, name: nonempty(p.name), description: p.description, priceCents: integer(p.priceCents, 0, 'INVALID_PRICE'),
          categoryId: documentId(p.categoryId), publishable: true, available: p.available, maxQuantity: p.maxQuantity }
      })
      requireRule(products.length <= 50 && categories.length <= 5, 'INVALID_INPUT')
      return { status: 'READY', catalog: { store, categories, products: products.filter(p => categories.some(c => c.id === p.categoryId)) } }
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'permission-denied') return { status: 'UNAVAILABLE' }
      throw error
    }
  }
}
