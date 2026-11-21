import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, runTransaction, writeBatch, Timestamp } from 'firebase/firestore'
import { pathToFileURL } from 'node:url'
import { seedLocalFixtures } from './seed-local.mjs'

// Explicit, disposable DEMO setup. No production publication authority is implemented.
export async function withLocalPublicFixture(work) {
  await fetch('http://127.0.0.1:8180/', { signal: AbortSignal.timeout(3000) })
  const env = await initializeTestEnvironment({ projectId: 'demo-ats-loja-digital', firestore: { host: '127.0.0.1', port: 8180 } })
  try {
    let result
    await env.withSecurityRulesDisabled(async context => { result = await work(context.firestore()) })
    return result
  } finally { await env.cleanup() }
}
export async function seedPublicFixtures() {
  await seedLocalFixtures({ reset: true })
  await withLocalPublicFixture(async db => {
    for (const suffix of ['a', 'b']) {
      const storeId = `store-demo-${suffix}`, slug = `store-${suffix}-demo`, name = suffix === 'a' ? 'Store Demo' : 'Store Demo B'
      const storeRef = doc(db, 'stores', storeId), slugRef = doc(db, 'publicStoreSlugs', slug)
      await runTransaction(db, async tx => {
        const mapping = await tx.get(slugRef)
        if (mapping.exists() && mapping.data().storeId !== storeId) throw new Error('SLUG_ALREADY_EXISTS')
        tx.set(slugRef, { storeId })
        tx.update(storeRef, { name, whatsapp: '15555550101', publicCatalogEnabled: true, usage: { productCount: 3, categoryCount: 2, revision: 0 } })
        tx.set(doc(db, 'publicStores', storeId), { storeId, slug, name, themePreset: suffix === 'a' ? 'clean' : 'dark', publishable: true, whatsapp: '15555550101' })
        for (const [id, categoryName, productCount] of [['essentials', 'Essenciais DEMO', 2], ['collection', 'Coleção DEMO', 1]]) {
          tx.set(doc(storeRef, 'categories', id), { id, storeId, name: categoryName, status: 'ACTIVE', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), productCount, catalogRevision: 0 })
          tx.set(doc(db, 'publicStores', storeId, 'categories', id), { id, storeId, name: categoryName, publishable: true })
        }
        for (const [id, productName, priceCents, categoryId, stock, maxQuantity] of [
          ['essential', 'Produto Essencial DEMO', 1990, 'essentials', 3, 2],
          ['special', 'Produto Especial DEMO', 129990, 'collection', 8, 5],
          ['unavailable', 'Produto Indisponível DEMO', 3990, 'essentials', 0, 0],
        ]) {
          tx.set(doc(storeRef, 'products', id), { id, storeId, name: productName, description: 'Produto genérico para demonstração local.', priceCents, categoryId, stock, status: 'ACTIVE', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), catalogRevision: 0 })
          tx.set(doc(db, 'publicStores', storeId, 'products', id), { id, storeId, name: productName, description: 'Produto genérico para demonstração local.', priceCents, categoryId, publishable: true, available: stock > 0, maxQuantity })
          if (stock > 0) tx.set(doc(storeRef, 'stockMovements', id), { id, storeId, productId: id, type: 'MANUAL_ENTRY', quantity: stock, previousStock: 0, newStock: stock, reason: 'Estoque inicial da fixture DEMO', createdAt: Timestamp.now(), createdBy: 'local-fixture', idempotencyKey: `initial:${id}` })
        }
      })
    }
  })
}
export async function changePublicFixture({ priceCents, themePreset } = {}) {
  await withLocalPublicFixture(async db => {
    const batch = writeBatch(db), ref = doc(db, 'stores/store-demo-a')
    if (priceCents !== undefined) {
      if (!Number.isSafeInteger(priceCents) || priceCents < 0) throw new Error('Invalid fixture price')
      const revision = (await getDoc(ref)).data().usage.revision + 1
      batch.update(doc(db, 'stores/store-demo-a/products/essential'), { priceCents, updatedAt: Timestamp.now(), catalogRevision: revision })
      batch.update(doc(db, 'publicStores/store-demo-a/products/essential'), { priceCents })
      batch.update(ref, { 'usage.revision': revision, catalogMutation: { kind: 'PRODUCT', id: 'essential' } })
    }
    if (themePreset !== undefined) {
      if (!['clean', 'premium', 'dark', 'playful', 'classic', 'bold'].includes(themePreset)) throw new Error('Invalid fixture theme')
      batch.update(doc(db, 'publicStores/store-demo-a'), { themePreset })
    }
    await batch.commit()
  })
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seedPublicFixtures()
  console.log('Fixtures públicas DEMO prontas: /loja/store-a-demo e /loja/store-b-demo. Catálogos DEMO reiniciados.')
}
