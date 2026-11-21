import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { createRulesEnvironment, profile, store } from './testConfig'

let env: RulesTestEnvironment

beforeAll(async () => { env = await createRulesEnvironment() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, 'users', 'merchant-a'), profile('merchant-a', 'MERCHANT', 'store-a')),
      setDoc(doc(db, 'users', 'merchant-b'), profile('merchant-b', 'MERCHANT', 'store-b')),
      setDoc(doc(db, 'users', 'master'), profile('master', 'MASTER', null)),
      setDoc(doc(db, 'users', 'disabled'), profile('disabled', 'MERCHANT', 'store-a', 'DISABLED')),
      setDoc(doc(db, 'users', 'invalid'), profile('invalid', 'OWNER', 'store-a')),
      setDoc(doc(db, 'users', 'empty-store'), profile('empty-store', 'MERCHANT', '')),
      setDoc(doc(db, 'stores', 'store-a'), { ...store('store-a'), publicCatalogEnabled: true }),
      setDoc(doc(db, 'stores', 'store-b'), store('store-b')),
      setDoc(doc(db, 'stores', 'store-suspended'), { ...store('store-suspended', 'SUSPENDED'), publicCatalogEnabled: true }),
      setDoc(doc(db, 'plans', 'ats-loja-digital'), { name: 'ATS Loja Digital' }),
      setDoc(doc(db, 'stores/store-a/products', 'same-id'), { storeId: 'store-a', name: 'A' }),
      setDoc(doc(db, 'stores/store-b/products', 'same-id'), { storeId: 'store-b', name: 'B' }),
      setDoc(doc(db, 'publicStores', 'store-a'), { publishable: true, name: 'A' }),
      setDoc(doc(db, 'publicStores/store-a/products', 'public-product'), { publishable: true, name: 'Public' }),
      setDoc(doc(db, 'publicStores', 'store-suspended'), { publishable: true, name: 'Suspended' }),
    ])
  })
})
afterAll(async () => { await env.cleanup() })

const publicDb = () => env.unauthenticatedContext().firestore()
const userDb = (uid: string) => env.authenticatedContext(uid).firestore()

describe('Firestore default-deny permission matrix', () => {
  it('PUBLIC cannot read users or private stores', async () => {
    await assertFails(getDoc(doc(publicDb(), 'users', 'merchant-a')))
    await assertFails(getDoc(doc(publicDb(), 'stores', 'store-a')))
  })
  it('PUBLIC cannot write users or private stores', async () => {
    await assertFails(setDoc(doc(publicDb(), 'users', 'attacker'), profile('attacker', 'MASTER', null)))
    await assertFails(setDoc(doc(publicDb(), 'stores', 'store-a'), { status: 'ACTIVE' }))
  })
  it('MERCHANT_A reads own profile and own store only', async () => {
    await assertSucceeds(getDoc(doc(userDb('merchant-a'), 'users', 'merchant-a')))
    await assertFails(getDoc(doc(userDb('merchant-a'), 'users', 'merchant-b')))
    await assertSucceeds(getDoc(doc(userDb('merchant-a'), 'stores', 'store-a')))
    await assertFails(getDoc(doc(userDb('merchant-a'), 'stores', 'store-b')))
  })
  it('MERCHANT_B reads Store B and not Store A', async () => {
    await assertSucceeds(getDoc(doc(userDb('merchant-b'), 'stores', 'store-b')))
    await assertFails(getDoc(doc(userDb('merchant-b'), 'stores', 'store-a')))
  })
  it('MASTER reads users and stores, including administrative lists', async () => {
    await assertSucceeds(getDoc(doc(userDb('master'), 'users', 'merchant-a')))
    await assertSucceeds(getDocs(collection(userDb('master'), 'users')))
    await assertSucceeds(getDoc(doc(userDb('master'), 'stores', 'store-a')))
    await assertSucceeds(getDocs(collection(userDb('master'), 'stores')))
  })
  it.each(['missing', 'disabled', 'invalid', 'empty-store'])('%s profile has no private access', async uid => {
    await assertFails(getDoc(doc(userDb(uid), 'stores', 'store-a')))
    await assertFails(getDoc(doc(userDb(uid), 'users', uid)))
  })
  it.each(['role', 'storeId', 'status'])('MERCHANT cannot alter own %s', async field => {
    await assertFails(setDoc(doc(userDb('merchant-a'), 'users', 'merchant-a'), { [field]: 'attacker' }, { merge: true }))
  })
  it('MERCHANT cannot create another user and MASTER client cannot provision a Master', async () => {
    await assertFails(setDoc(doc(userDb('merchant-a'), 'users', 'new'), profile('new', 'MASTER', null)))
    await assertFails(setDoc(doc(userDb('master'), 'users', 'new-master'), profile('new-master', 'MASTER', null)))
  })
  it('known IDs and storeId in payload do not grant cross-store access', async () => {
    await assertFails(getDoc(doc(userDb('merchant-a'), 'stores/store-b/products', 'same-id')))
    await assertFails(setDoc(doc(userDb('merchant-a'), 'stores/store-b/products', 'injected'), { storeId: 'store-a' }))
    await assertFails(setDoc(doc(userDb('merchant-a'), 'stores/store-a/products', 'injected'), { storeId: 'store-b' }))
  })
  it('cross-store queries stay denied; Phase 5 opens only own catalog reads', async () => {
    await assertFails(getDocs(collection(userDb('merchant-a'), 'stores')))
    await assertFails(getDocs(query(collection(userDb('merchant-a'), 'stores/store-b/products'), where('storeId', '==', 'store-a'))))
    await assertSucceeds(getDoc(doc(userDb('merchant-a'), 'stores/store-a/products', 'same-id')))
  })
  it('merchant and master clients cannot write private stores or commercial subcollections', async () => {
    await assertFails(setDoc(doc(userDb('merchant-a'), 'stores', 'store-a'), { status: 'SUSPENDED' }, { merge: true }))
    await assertFails(setDoc(doc(userDb('master'), 'stores', 'store-a'), { status: 'SUSPENDED' }, { merge: true }))
    await assertFails(setDoc(doc(userDb('master'), 'stores/store-a/orders', 'order'), { status: 'PENDING' }))
  })
  it('only the associated plan is readable; all client plan writes are denied', async () => {
    await assertSucceeds(getDoc(doc(userDb('merchant-a'), 'plans', 'ats-loja-digital')))
    await assertSucceeds(getDoc(doc(userDb('master'), 'plans', 'ats-loja-digital')))
    await assertFails(getDoc(doc(publicDb(), 'plans', 'ats-loja-digital')))
    await assertFails(setDoc(doc(userDb('master'), 'plans', 'new'), { name: 'New' }))
  })
  it('public projections require publishable flags and ACTIVE private store', async () => {
    await assertSucceeds(getDoc(doc(publicDb(), 'publicStores', 'store-a')))
    await assertSucceeds(getDoc(doc(publicDb(), 'publicStores/store-a/products', 'public-product')))
    await assertFails(getDoc(doc(publicDb(), 'publicStores', 'store-suspended')))
    await assertFails(setDoc(doc(publicDb(), 'publicStores', 'store-a'), { publishable: true }))
  })
  it('an unknown collection is denied by default', async () => {
    await assertFails(getDoc(doc(userDb('master'), 'unknown', 'document')))
    await assertFails(setDoc(doc(userDb('master'), 'unknown', 'document'), { open: true }))
  })
})
