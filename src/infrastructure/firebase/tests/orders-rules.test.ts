import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createRulesEnvironment, profile, store } from './testConfig'
let env: RulesTestEnvironment
beforeAll(async () => { env = await createRulesEnvironment() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore(), batch = writeBatch(db)
    for (const suffix of ['a', 'b']) {
      batch.set(doc(db, 'users', `merchant-${suffix}`), profile(`merchant-${suffix}`, 'MERCHANT', `store-${suffix}`))
      batch.set(doc(db, 'stores', `store-${suffix}`), { ...store(`store-${suffix}`), publicCatalogEnabled: true })
      batch.set(doc(db, 'publicStores', `store-${suffix}`), { storeId: `store-${suffix}`, slug: `store-${suffix}`, name: `Store store-${suffix}`, themePreset: 'clean', publishable: true })
      batch.set(doc(db, `stores/store-${suffix}/orders/order`), { id: 'order', storeId: `store-${suffix}`, status: 'PENDING', totalCents: 1990 })
      batch.set(doc(db, `stores/store-${suffix}/stockMovements/movement`), { id: 'movement', storeId: `store-${suffix}`, quantity: 1 })
      batch.set(doc(db, `stores/store-${suffix}/products/product`), { id: 'product', storeId: `store-${suffix}`, stock: 3 })
    }
    batch.set(doc(db, 'users', 'disabled'), profile('disabled', 'MERCHANT', 'store-a', 'DISABLED'))
    await batch.commit()
  })
})
afterAll(async () => { await env.cleanup() })
const merchant = () => env.authenticatedContext('merchant-a').firestore()
describe('order and stock Web SDK boundary', () => {
  it.each(['orders/order', 'stockMovements/movement'])('Merchant reads own %s but never Store B', async path => {
    await assertSucceeds(getDoc(doc(merchant(), `stores/store-a/${path}`)))
    await assertFails(getDoc(doc(merchant(), `stores/store-b/${path}`)))
  })
  it.each(['orders/order', 'stockMovements/movement'])('PUBLIC and DISABLED cannot read known %s', async path => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `stores/store-a/${path}`)))
    await assertFails(getDoc(doc(env.authenticatedContext('disabled').firestore(), `stores/store-a/${path}`)))
  })
  it.each([{ totalCents: 1 }, { status: 'CONFIRMED' }, { storeId: 'store-b' }])('Merchant cannot forge order update %j', async payload => {
    await assertFails(updateDoc(doc(merchant(), 'stores/store-a/orders/order'), payload))
  })
  it('PUBLIC and Merchant cannot directly create orders', async () => {
    for (const db of [merchant(), env.unauthenticatedContext().firestore()]) await assertFails(setDoc(doc(db, 'stores/store-a/orders/new'), { status: 'PENDING' }))
  })
  it('Merchant cannot directly change existing stock or ledger', async () => {
    await assertFails(updateDoc(doc(merchant(), 'stores/store-a/products/product'), { stock: 0 }))
    await assertFails(updateDoc(doc(merchant(), 'stores/store-a/stockMovements/movement'), { quantity: 500 }))
    await assertFails(setDoc(doc(merchant(), 'stores/store-a/movementRequests/forged'), { movementId: 'movement' }))
  })
  it('permits synchronized normalized WhatsApp allowlist update', async () => {
    const db = merchant(), batch = writeBatch(db)
    batch.update(doc(db, 'stores/store-a'), { whatsapp: '15555550101', updatedAt: serverTimestamp() })
    batch.update(doc(db, 'publicStores/store-a'), { whatsapp: '15555550101' })
    await assertSucceeds(batch.commit())
  })
  it.each(['invalid', '123', '<script>'])('denies malformed WhatsApp %s even in synchronized batch', async whatsapp => {
    const db = merchant(), batch = writeBatch(db)
    batch.update(doc(db, 'stores/store-a'), { whatsapp, updatedAt: serverTimestamp() }); batch.update(doc(db, 'publicStores/store-a'), { whatsapp })
    await assertFails(batch.commit())
  })
  it('denies unsynchronized private or public WhatsApp modification', async () => {
    await assertFails(updateDoc(doc(merchant(), 'stores/store-a'), { whatsapp: '15555550101', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(merchant(), 'publicStores/store-a'), { whatsapp: '15555550101' }))
  })
  it.each(['ownerUid', 'planId', 'billingStatus', 'status', 'usage', 'storeId'])('WhatsApp edit does not allow administrative field %s', async field => {
    await assertFails(updateDoc(doc(merchant(), 'stores/store-a'), { whatsapp: '15555550101', [field]: 'forged', updatedAt: serverTimestamp() }))
  })
  it('suspended Store retains own history reads but cannot edit WhatsApp', async () => {
    await env.withSecurityRulesDisabled(async c => { await updateDoc(doc(c.firestore(), 'stores/store-a'), { status: 'SUSPENDED' }) })
    await assertSucceeds(getDoc(doc(merchant(), 'stores/store-a/orders/order')))
    await assertFails(updateDoc(doc(merchant(), 'stores/store-a'), { whatsapp: '', updatedAt: serverTimestamp() }))
  })
})
