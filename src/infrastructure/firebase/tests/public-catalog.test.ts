import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp, type Firestore } from 'firebase/firestore'
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createRulesEnvironment, profile, store } from './testConfig'
import { FirestoreCatalogUnitOfWork } from '../catalog/FirestoreCatalogUnitOfWork'
import { FirestorePublicCatalogRepository } from '../catalog/FirestorePublicCatalogRepository'
import { RegisterProduct } from '../../../modules/products/application/RegisterProduct'
import { ManageProducts } from '../../../modules/products/application/ManageProducts'
import { ManageCategories } from '../../../modules/categories/application/ManageCategories'
import type { ActorContext } from '../../../shared/domain/ActorContext'

let env: RulesTestEnvironment
const actor: ActorContext = { actorId: 'merchant-a', role: 'MERCHANT', storeId: 'store-a' }
const runtime = { now: () => new Date().toISOString(), nextId: () => randomUUID() }
const db = (uid?: string) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore
const unit = () => new FirestoreCatalogUnitOfWork(db('merchant-a'), 'store-a')
const repository = () => new FirestorePublicCatalogRepository(db())
let categoryId: string
beforeAll(async () => { env = await createRulesEnvironment() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const d = context.firestore()
    await setDoc(doc(d, 'stores/store-a'), { ...store('store-a'), slug: 'store-demo', publicCatalogEnabled: true, usage: { productCount: 0, categoryCount: 0, revision: 0 }, catalogMutation: { kind: 'CATEGORY', id: 'initial' } })
    await setDoc(doc(d, 'users/merchant-a'), profile('merchant-a', 'MERCHANT', 'store-a'))
    await setDoc(doc(d, 'users/merchant-b'), profile('merchant-b', 'MERCHANT', 'store-b'))
    await setDoc(doc(d, 'publicStoreSlugs/store-demo'), { storeId: 'store-a' })
    await setDoc(doc(d, 'publicStores/store-a'), { storeId: 'store-a', slug: 'store-demo', name: 'Store store-a', themePreset: 'clean', publishable: true })
  })
  categoryId = (await new ManageCategories(unit(), runtime).create(actor, { storeId: 'store-a', name: 'Categoria DEMO' })).id
})
afterAll(async () => { await env.cleanup() })
const create = (stock = 3) => new RegisterProduct(unit(), runtime).execute(actor, { storeId: 'store-a', name: 'Produto DEMO', description: 'Somente catálogo', priceCents: 1990, categoryId, initialStock: stock, status: 'ACTIVE' })
const publicRef = (id: string) => doc(db(), `publicStores/store-a/products/${id}`)

describe('projeções públicas reais', () => {
  it('cria/lê catálogo por slug normalizado e sanitiza produto/categoria', async () => {
    const p = await create()
    const result = await repository().load(' STORE DEMO ')
    expect(result.status).toBe('READY')
    if (result.status !== 'READY') return
    expect(result.catalog.products[0]).toMatchObject({ id: p.id, priceCents: 1990, available: true, maxQuantity: 2 })
    expect(Object.keys(result.catalog.products[0]).sort()).toEqual(['id', 'storeId', 'name', 'description', 'priceCents', 'categoryId', 'publishable', 'available', 'maxQuantity'].sort())
    expect(Object.keys(result.catalog.categories[0]).sort()).toEqual(['id', 'storeId', 'name', 'publishable'].sort())
    expect(result.catalog.store).not.toHaveProperty('billingStatus')
  })
  it.each(['invalid//slug', 'missing-store'])('slug %s resolve Not Found', async slug => {
    expect(await repository().load(slug)).toEqual({ status: 'NOT_FOUND' })
  })
  it('edição de nome/preço/descrição e categoria sincroniza na mesma transação', async () => {
    const p = await create(), c = await new ManageCategories(unit(), runtime).create(actor, { storeId: 'store-a', name: 'Outra DEMO' })
    await new ManageProducts(unit(), runtime).update(actor, 'store-a', p.id, { name: 'Editado DEMO', description: 'Novo texto', priceCents: 129990, categoryId: c.id })
    expect((await getDoc(publicRef(p.id))).data()).toMatchObject({ name: 'Editado DEMO', description: 'Novo texto', priceCents: 129990, categoryId: c.id })
  })
  it.each(['INACTIVE', 'ARCHIVED'] as const)('%s deixa de ser legível e reativação republica', async status => {
    const p = await create(), commands = new ManageProducts(unit(), runtime)
    await commands.update(actor, 'store-a', p.id, { status })
    await assertFails(getDoc(publicRef(p.id)))
    const result = await repository().load('store-demo')
    expect(result.status === 'READY' && result.catalog.products.length).toBe(0)
    await commands.update(actor, 'store-a', p.id, { status: 'ACTIVE' })
    await assertSucceeds(getDoc(publicRef(p.id)))
  })
  it('categoria renomeada/arquivada/reativada acompanha fluxo privado', async () => {
    const commands = new ManageCategories(unit(), runtime)
    await commands.rename(actor, 'store-a', categoryId, 'Nova categoria DEMO')
    expect((await getDoc(doc(db(), `publicStores/store-a/categories/${categoryId}`))).data()?.name).toBe('Nova categoria DEMO')
    await commands.setStatus(actor, 'store-a', categoryId, 'ARCHIVED')
    await assertFails(getDoc(doc(db(), `publicStores/store-a/categories/${categoryId}`)))
    await commands.setStatus(actor, 'store-a', categoryId, 'ACTIVE')
    await assertSucceeds(getDoc(doc(db(), `publicStores/store-a/categories/${categoryId}`)))
  })
  it('nome da Store sincroniza; gravação privada sem projeção é negada', async () => {
    await unit().renameStore('Store Demo editada')
    expect((await getDoc(doc(db(), 'publicStores/store-a'))).data()?.name).toBe('Store Demo editada')
    await assertFails(updateDoc(doc(db('merchant-a'), 'stores/store-a'), { name: 'Sem projeção', updatedAt: serverTimestamp() }))
  })
  it('suspensão bloqueia índice, loja e produto antigo; reativação restaura', async () => {
    const p = await create()
    await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'stores/store-a'), { status: 'SUSPENDED' }))
    for (const path of ['publicStores/store-a', `publicStores/store-a/products/${p.id}`, 'publicStoreSlugs/store-demo']) await assertFails(getDoc(doc(db(), path)))
    expect(await repository().load('store-demo')).toEqual({ status: 'UNAVAILABLE' })
    await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'stores/store-a'), { status: 'ACTIVE' }))
    expect((await repository().load('store-demo')).status).toBe('READY')
  })
  it('projeção antiga sem publicação habilitada permanece fechada', async () => {
    const p = await create()
    await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'stores/store-a'), { publicCatalogEnabled: false }))
    for (const path of ['publicStores/store-a', `publicStores/store-a/products/${p.id}`, 'publicStoreSlugs/store-demo']) await assertFails(getDoc(doc(db(), path)))
    expect(await repository().load('store-demo')).toEqual({ status: 'UNAVAILABLE' })
  })
  it.each([0, 1, 2, 3, 4, 5, 90])('estoque %s vira somente disponibilidade e teto conservador', async stock => {
    const p = await create(stock), data = (await getDoc(publicRef(p.id))).data()!
    expect(data.available).toBe(stock > 0); expect(data.maxQuantity).toBeLessThanOrEqual(stock)
    expect([0, 1, 2, 5]).toContain(data.maxQuantity); expect(data).not.toHaveProperty('stock')
  })
  it.each(['stores/store-a', 'stores/store-a/categories/known', 'stores/store-a/products/known', 'stores/store-a/orders/known', 'stores/store-a/billing/known', 'users/merchant-a'])('PUBLIC não lê %s', async path => {
    await assertFails(getDoc(doc(db(), path)))
  })
  it.each(['publicStores/store-a', 'publicStores/store-a/products/attack', 'publicStores/store-a/categories/attack', 'publicStoreSlugs/attack'])('PUBLIC não grava %s', async path => {
    await assertFails(setDoc(doc(db(), path), { publishable: true, name: 'Attack' }))
  })
  it('Merchant B não manipula projeção A nem Merchant A adulterar preço/tema/flag', async () => {
    const p = await create()
    await assertFails(updateDoc(doc(db('merchant-b'), `publicStores/store-a/products/${p.id}`), { priceCents: 0 }))
    await assertFails(updateDoc(doc(db('merchant-a'), `publicStores/store-a/products/${p.id}`), { priceCents: 0 }))
    await assertFails(updateDoc(doc(db('merchant-a'), 'publicStores/store-a'), { themePreset: 'dark' }))
    await assertFails(updateDoc(doc(db('merchant-a'), 'stores/store-a'), { publicCatalogEnabled: false }))
    await assertFails(setDoc(doc(db('merchant-b'), 'publicStoreSlugs/store-demo'), { storeId: 'store-b' }))
  })
  it('payload privado não pode ser acrescentado à projeção nem lido se fixture corrompida', async () => {
    const p = await create()
    await assertFails(updateDoc(doc(db('merchant-a'), `publicStores/store-a/products/${p.id}`), { stock: 3, createdBy: 'secret' }))
    await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), `publicStores/store-a/products/${p.id}`), { stock: 3 }))
    await assertFails(getDoc(publicRef(p.id)))
    await assertFails(updateDoc(doc(db('merchant-a'), 'publicStores/store-a'), { billingStatus: 'PAID', ownerUid: 'secret' }))
    await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'publicStores/store-a'), { billingStatus: 'PAID' }))
    await assertFails(getDoc(doc(db(), 'publicStores/store-a')))
  })
  it('batch privado sem atualizar projeção é negado e faz rollback', async () => {
    const p = await create(), d = db('merchant-a'), s = (await getDoc(doc(d, 'stores/store-a'))).data()!, batch = writeBatch(d)
    batch.update(doc(d, `stores/store-a/products/${p.id}`), { name: 'Forjado', catalogRevision: s.usage.revision + 1, updatedAt: serverTimestamp() })
    batch.update(doc(d, 'stores/store-a'), { usage: { ...s.usage, revision: s.usage.revision + 1 }, catalogMutation: { kind: 'PRODUCT', id: p.id } })
    await assertFails(batch.commit())
    expect((await getDoc(publicRef(p.id))).data()?.name).toBe('Produto DEMO')
  })
})
