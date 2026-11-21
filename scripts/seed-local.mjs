import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, writeBatch, Timestamp } from 'firebase/firestore'
import { pathToFileURL } from 'node:url'

// Public credentials of disposable LOCAL fixtures. Never imported into the application bundle.
export const demoCredentials = { email: 'merchant-a@ats-demo.test', password: 'AtsDemo2026!' }
export async function seedLocalFixtures({ reset = false } = {}) {
  const projectId = 'demo-ats-loja-digital'
  await Promise.all(['http://127.0.0.1:9099/', 'http://127.0.0.1:8180/'].map(url => fetch(url, { signal: AbortSignal.timeout(3000) })))
  const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8180 } })
  try {
    for (const suffix of ['a', 'b']) {
      const email = `merchant-${suffix}@ats-demo.test`, password = demoCredentials.password
      const authRequest = method => fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${method}?key=demo-api-key`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
      })
      let response = await authRequest('signUp')
      if (!response.ok) response = await authRequest('signInWithPassword')
      if (!response.ok) throw new Error('Cannot provision local fixture account')
      const { localId: uid } = await response.json()
      const storeId = `store-demo-${suffix}`, now = new Date().toISOString()
      await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore(), ref = doc(db, 'stores', storeId)
        if (reset) {
          const slugOwner = await getDoc(doc(db, 'publicStoreSlugs', `store-${suffix}-demo`))
          if (slugOwner.exists() && slugOwner.data().storeId !== storeId) throw new Error('SLUG_ALREADY_EXISTS')
          for (const name of ['products', 'categories']) {
            const publicDocs = await getDocs(collection(db, 'publicStores', storeId, name))
            for (let offset = 0; offset < publicDocs.docs.length; offset += 400) {
              const batch = writeBatch(db)
              publicDocs.docs.slice(offset, offset + 400).forEach(row => batch.delete(row.ref))
              await batch.commit()
            }
          }
          const publicBatch = writeBatch(db)
          publicBatch.delete(doc(db, 'publicStores', storeId))
          publicBatch.delete(doc(db, 'publicStoreSlugs', `store-${suffix}-demo`))
          await publicBatch.commit()
          // Only the explicitly named disposable fixture stores; no database-wide reset.
          for (const name of ['products', 'categories', 'stockMovements', 'orders', 'orderRequests', 'movementRequests']) {
            const docs = await getDocs(collection(ref, name))
            for (let offset = 0; offset < docs.docs.length; offset += 400) {
              const batch = writeBatch(db)
              docs.docs.slice(offset, offset + 400).forEach(row => batch.delete(row.ref))
              await batch.commit()
            }
          }
        }
        if (reset || !(await getDoc(ref)).exists()) await setDoc(ref, {
          id: storeId, slug: `store-${suffix}-demo`, name: `Store ${suffix.toUpperCase()} DEMO`, status: 'ACTIVE',
          planId: 'ats-loja-digital', billingStatus: 'PENDING', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
          usage: { productCount: 0, categoryCount: 0, revision: 0 }, catalogMutation: { kind: 'CATEGORY', id: 'initial' },
        })
        await setDoc(doc(db, 'users', uid), { uid, email, name: `Merchant ${suffix.toUpperCase()} DEMO`, role: 'MERCHANT', storeId, status: 'ACTIVE', createdAt: now, updatedAt: now })
      })
    }
  } finally { await env.cleanup() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seedLocalFixtures({ reset: process.argv.includes('--reset-demo') })
  console.log('Fixtures locais Merchant A/B e Store A/B prontas. Credenciais documentadas no README.')
}
