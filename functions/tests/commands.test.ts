import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { executeCommand } from '../src/commands'
import { assertLocalEnvironment } from '../src/localEnvironment'
import { movementDto, orderDto, productDto } from '../src/dto'
import type { OrderReceipt } from '../../src/modules/orders/application/Checkout'
import type { Order } from '../../src/modules/orders/domain/Order'

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180'
process.env.METADATA_SERVER_DETECTION = 'none'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const app = initializeApp({ projectId: 'demo-ats-loja-digital' }, 'phase7-tests')
const db = getFirestore(app), storeId = 'commands-a', uid = 'commands-user-a'
const ref = (path: string) => db.doc(`stores/${storeId}/${path}`)
const command = (name: string, input: unknown, actor: string | undefined = uid) => executeCommand(db, name, input, actor)
const input = () => ({ slug: 'commands-demo', items: [{ productId: 'p1', quantity: 1 }], customer: { name: 'Cliente DEMO', phone: '15555550102', note: 'Teste local' }, idempotencyKey: randomUUID() })
const create = (value = input()) => executeCommand(db, 'createPendingOrder', value) as Promise<OrderReceipt>
const stock = async (id = 'p1') => (await ref(`products/${id}`).get()).data()!.stock
const order = async (id: string) => orderDto((await ref(`orders/${id}`).get()).data(), storeId, id)
const movements = async () => (await db.collection(`stores/${storeId}/stockMovements`).get()).docs.map(row => row.data())
beforeAll(async () => {
  try { await getAuth(app).createUser({ uid, email: 'commands@ats-demo.test', password: 'AtsDemo2026!' }) }
  catch (error) { if ((error as { code?: string }).code !== 'auth/uid-already-exists') throw error }
})
beforeEach(async () => {
  await db.recursiveDelete(db.doc(`stores/${storeId}`))
  const now = Timestamp.now(), batch = db.batch()
  batch.set(db.doc(`stores/${storeId}`), { id: storeId, slug: 'commands-demo', name: 'Store DEMO', status: 'ACTIVE', whatsapp: '15555550101',
    planId: 'ats-loja-digital', billingStatus: 'PENDING', createdAt: now, updatedAt: now, publicCatalogEnabled: true,
    usage: { productCount: 2, categoryCount: 1, revision: 0 }, catalogMutation: { kind: 'PRODUCT', id: 'p1' } })
  batch.set(db.doc('publicStoreSlugs/commands-demo'), { storeId })
  batch.set(db.doc(`publicStores/${storeId}`), { storeId, slug: 'commands-demo', name: 'Store DEMO', themePreset: 'clean', publishable: true, whatsapp: '15555550101' })
  batch.set(db.doc(`users/${uid}`), { uid, role: 'MERCHANT', status: 'ACTIVE', storeId })
  batch.set(db.doc('users/commands-user-b'), { uid: 'commands-user-b', role: 'MERCHANT', status: 'ACTIVE', storeId: 'commands-b' })
  batch.set(db.doc('stores/commands-b'), { id: 'commands-b', status: 'ACTIVE', createdAt: now, updatedAt: now })
  batch.set(ref('categories/c1'), { id: 'c1', storeId, name: 'Categoria DEMO', status: 'ACTIVE' })
  for (const id of ['p1', 'p2']) batch.set(ref(`products/${id}`), { id, storeId, name: `Produto ${id} DEMO`, description: 'DEMO', priceCents: 1990,
    stock: 5, categoryId: 'c1', status: 'ACTIVE', createdAt: new Timestamp(1700000000, 123456789), updatedAt: now, catalogRevision: 0 })
  await batch.commit()
})
afterAll(async () => { await db.terminate(); await deleteApp(app) })

describe('privileged local commerce', () => {
  it('creates an authoritative pending snapshot without stock or movements', async () => {
    const result = await create(); expect(result.totalCents).toBe(1990); expect(result.items[0].name).toBe('Produto p1 DEMO')
    expect((await order(result.id)).status).toBe('PENDING'); expect(await stock()).toBe(5); expect(await movements()).toHaveLength(0)
    expect(Object.keys(result)).not.toContain('requestFingerprint')
  })
  it('consolidates repeated products before calculating prices', async () => {
    const result = await create({ ...input(), items: [{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 2 }] })
    expect(result.items).toHaveLength(1); expect(result.totalCents).toBe(5970)
  })
  it('creation retry and concurrent duplicate preserve one order', async () => {
    const request = input(); const results = await Promise.all([create(request), create(request)])
    expect(results[0]).toEqual(results[1]); expect((await db.collection(`stores/${storeId}/orders`).get()).size).toBe(1)
  })
  it('changed payload with same key conflicts', async () => {
    const request = input(); await create(request)
    await expect(create({ ...request, customer: { ...request.customer, name: 'Outro DEMO' } })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })
  it('retry preserves snapshot even after product price/name changes', async () => {
    const request = input(), original = await create(request)
    await ref('products/p1').update({ priceCents: 100, name: 'Novo DEMO' })
    expect((await create(request)).items).toEqual(original.items)
  })
  it.each(['priceCents', 'totalCents', 'productName', 'storeId', 'role', 'status'])('rejects injected public field %s', async field => {
    await expect(create({ ...input(), [field]: 0 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it.each([0, -1, 1.5, 6])('rejects invalid public quantity %s', async quantity => {
    await expect(create({ ...input(), items: [{ productId: 'p1', quantity }] })).rejects.toMatchObject({ code: 'INVALID_QUANTITY' })
  })
  it.each(['INACTIVE', 'ARCHIVED'])('rejects %s product', async status => {
    await ref('products/p1').update({ status }); await expect(create()).rejects.toMatchObject({ code: 'PRODUCT_UNAVAILABLE' })
  })
  it('rejects cross-store entity and forged item pricing', async () => {
    await ref('products/p1').update({ storeId: 'commands-b' }); await expect(create()).rejects.toMatchObject({ code: 'CROSS_STORE_ACCESS' })
    await expect(create({ ...input(), items: [{ productId: 'p1', quantity: 1, priceCents: 1 } as { productId: string; quantity: number }] })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it.each([{ name: '<b>DEMO</b>' }, { phone: '123' }, { note: 'x'.repeat(501) }, { name: 'DEMO\nInjected' }, { ownerUid: 'admin' }])('rejects malformed customer %j', async value => {
    await expect(create({ ...input(), customer: { ...input().customer, ...value } })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('does not create an order without valid Store WhatsApp', async () => {
    await db.doc(`stores/${storeId}`).update({ whatsapp: '' }); await expect(create()).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await db.collection(`stores/${storeId}/orders`).get()).empty).toBe(true)
  })
  it('confirms once, writes ledger and public availability atomically', async () => {
    const createdAt = (await ref('products/p1').get()).data()!.createdAt
    const result = await create(); await command('confirmOrder', { orderId: result.id }); await command('confirmOrder', { orderId: result.id })
    expect(await stock()).toBe(4); expect(await movements()).toHaveLength(1); expect((await order(result.id)).confirmedBy).toBe(uid)
    expect((await db.doc(`publicStores/${storeId}/products/p1`).get()).data()).toMatchObject({ maxQuantity: 2, available: true })
    expect((await ref('products/p1').get()).data()!.createdAt.isEqual(createdAt)).toBe(true)
  })
  it('two confirmations of the same order concurrently debit once', async () => {
    const result = await create(); await Promise.all([command('confirmOrder', { orderId: result.id }), command('confirmOrder', { orderId: result.id })])
    expect(await stock()).toBe(4); expect(await movements()).toHaveLength(1)
  })
  it('two pending orders compete for the last item: exactly one wins', async () => {
    await ref('products/p1').update({ stock: 1 }); const a = await create(), b = await create()
    const results = await Promise.allSettled([command('confirmOrder', { orderId: a.id }), command('confirmOrder', { orderId: b.id })])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'INSUFFICIENT_STOCK' } })
    expect(await stock()).toBe(0); expect(await movements()).toHaveLength(1)
    expect([(await order(a.id)).status, (await order(b.id)).status].sort()).toEqual(['CONFIRMED', 'PENDING'])
  })
  it('insufficient second item rolls back all products and order', async () => {
    const result = await create({ ...input(), items: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }] })
    await ref('products/p2').update({ stock: 0 })
    await expect(command('confirmOrder', { orderId: result.id })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    expect(await stock()).toBe(5); expect(await stock('p2')).toBe(0); expect(await movements()).toHaveLength(0); expect((await order(result.id)).status).toBe('PENDING')
  })
  it.each(['products', 'movements', 'orders'] as const)('injected failure at %s rolls back multi-item confirmation', async stage => {
    const result = await create({ ...input(), items: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }] })
    await expect(executeCommand(db, 'confirmOrder', { orderId: result.id }, uid, point => { if (point === stage) throw new Error('injected') })).rejects.toThrow('injected')
    expect(await stock()).toBe(5); expect(await stock('p2')).toBe(5); expect(await movements()).toHaveLength(0); expect((await order(result.id)).status).toBe('PENDING')
  })
  it('pending cancellation leaves inventory untouched', async () => {
    const result = await create(); await command('cancelPendingOrder', { orderId: result.id })
    expect((await order(result.id)).status).toBe('CANCELLED'); expect(await stock()).toBe(5); expect(await movements()).toHaveLength(0)
    await expect(command('confirmOrder', { orderId: result.id })).rejects.toMatchObject({ code: 'INVALID_ORDER_STATE' })
  })
  it('full reversal is concurrent-idempotent and restores availability', async () => {
    const result = await create(); await command('confirmOrder', { orderId: result.id })
    await expect(command('cancelPendingOrder', { orderId: result.id })).rejects.toMatchObject({ code: 'INVALID_ORDER_STATE' })
    await Promise.all([command('reverseConfirmedOrder', { orderId: result.id }), command('reverseConfirmedOrder', { orderId: result.id })])
    expect(await stock()).toBe(5); expect(await movements()).toHaveLength(2); expect((await order(result.id)).status).toBe('REVERSED')
    expect((await db.doc(`publicStores/${storeId}/products/p1`).get()).data()!.maxQuantity).toBe(5)
    await expect(command('confirmOrder', { orderId: result.id })).rejects.toMatchObject({ code: 'INVALID_ORDER_STATE' })
  })
  it('reversal failure does not partially return multi-item stock', async () => {
    const result = await create({ ...input(), items: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }] })
    await command('confirmOrder', { orderId: result.id })
    await expect(executeCommand(db, 'reverseConfirmedOrder', { orderId: result.id }, uid, point => { if (point === 'orders') throw new Error('injected') })).rejects.toThrow('injected')
    expect(await stock()).toBe(4); expect(await stock('p2')).toBe(4); expect(await movements()).toHaveLength(2); expect((await order(result.id)).status).toBe('CONFIRMED')
  })
  it('pending order cannot be reversed', async () => {
    const result = await create(); await expect(command('reverseConfirmedOrder', { orderId: result.id })).rejects.toMatchObject({ code: 'INVALID_ORDER_STATE' })
  })
  it.each(['MANUAL_ENTRY', 'MANUAL_EXIT'])('manual %s creates exactly one movement under retry', async type => {
    const request = { productId: 'p1', type, quantity: 2, reason: 'Contagem DEMO', idempotencyKey: randomUUID() }
    await command('adjustStock', request); await command('adjustStock', request)
    expect(await stock()).toBe(type === 'MANUAL_ENTRY' ? 7 : 3); expect(await movements()).toHaveLength(1)
  })
  it.each([0, -1, 0.5, 6])('invalid/insufficient manual exit %s is atomic', async quantity => {
    await expect(command('adjustStock', { productId: 'p1', type: 'MANUAL_EXIT', quantity, reason: 'DEMO', idempotencyKey: randomUUID() })).rejects.toHaveProperty('code')
    expect(await stock()).toBe(5); expect(await movements()).toHaveLength(0)
  })
  it.each(['confirmOrder', 'cancelPendingOrder', 'reverseConfirmedOrder', 'adjustStock', 'createPendingOrder'])('suspended Store rejects %s', async action => {
    const result = await create(); await db.doc(`stores/${storeId}`).update({ status: 'SUSPENDED' })
    await expect(action === 'createPendingOrder' ? create() : command(action, action === 'adjustStock' ? {} : { orderId: result.id })).rejects.toMatchObject({ code: 'STORE_SUSPENDED' })
  })
  it.each(['DISABLED', 'MASTER'])('profile %s cannot invoke commercial commands', async state => {
    await db.doc(`users/${uid}`).update(state === 'MASTER' ? { role: 'MASTER', storeId: null } : { status: state })
    await expect(command('listOrders', {})).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
  })
  it('known order ID in another Store cannot be read or confirmed', async () => {
    const result = await create()
    for (const action of ['getOrder', 'confirmOrder']) await expect(command(action, { orderId: result.id }, 'commands-user-b')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
    await expect(command('confirmOrder', { orderId: result.id, storeId: 'commands-b' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('history uses bounded pages and cursor without duplicates', async () => {
    const receipt = await create(), template = (await ref(`orders/${receipt.id}`).get()).data()!, batch = db.batch()
    for (let i = 0; i < 28; i++) batch.set(ref(`orders/demo-${i}`), { ...template, id: `demo-${i}`, createdAt: new Timestamp(1700000000 + i, i) })
    await batch.commit()
    const first = await command('listOrders', { status: 'PENDING' }) as { items: Order[]; cursor: unknown }
    const second = await command('listOrders', { status: 'PENDING', cursor: first.cursor }) as { items: Order[] }
    expect(first.items).toHaveLength(25); expect(second.items).toHaveLength(4); expect(new Set([...first.items, ...second.items].map(o => o.id)).size).toBe(29)
  })
  it('DTOs reject wrong scope and malformed ledger', async () => {
    expect(() => productDto(({}), storeId, 'p1')).toThrow()
    expect(() => movementDto({ storeId: 'commands-b' }, storeId)).toThrow()
    const receipt = await create(), value = await order(receipt.id)
    expect(() => orderDto({ ...value, totalCents: 1 }, storeId, value.id)).toThrow()
    value.items[0].name = 'mutated'; expect((await order(receipt.id)).items[0].name).toBe('Produto p1 DEMO')
  })
  it('movement history returns at most 25 rows with a stable cursor', async () => {
    await command('adjustStock', { productId: 'p1', type: 'MANUAL_ENTRY', quantity: 1, reason: 'DEMO', idempotencyKey: randomUUID() })
    const template = (await db.collection(`stores/${storeId}/stockMovements`).get()).docs[0].data(), batch = db.batch()
    for (let i = 0; i < 26; i++) batch.set(ref(`stockMovements/demo-${i}`), { ...template, id: `demo-${i}`, createdAt: new Timestamp(1700000000 + i, 0) })
    await batch.commit()
    const first = await command('listMovements', {}) as { items: { id: string }[]; cursor: unknown }
    const second = await command('listMovements', { cursor: first.cursor }) as { items: { id: string }[] }
    expect(first.items).toHaveLength(25); expect(second.items).toHaveLength(2)
    expect(new Set([...first.items, ...second.items].map(m => m.id)).size).toBe(27)
  })
  it('HTTP endpoint validates real Emulator auth and denies forged tokens', async () => {
    const endpoint = 'http://127.0.0.1:5001/demo-ats-loja-digital/us-central1/commerce'
    const auth = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'commands@ats-demo.test', password: 'AtsDemo2026!', returnSecureToken: true }) })
    const { idToken } = await auth.json() as { idToken: string }
    for (const [token, expected] of [[idToken, 200], ['forged-token', 403], ['', 400]] as const) {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ command: 'listOrders', input: {} }) })
      expect(response.status).toBe(expected)
    }
  })
  it('local environment rejects every missing or remote prerequisite', () => {
    const env = { FUNCTIONS_EMULATOR: 'true', GCLOUD_PROJECT: 'demo-ats-loja-digital', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }
    expect(() => assertLocalEnvironment(env)).not.toThrow()
    for (const key of Object.keys(env)) expect(() => assertLocalEnvironment({ ...env, [key]: 'remote' })).toThrow()
  })
})
