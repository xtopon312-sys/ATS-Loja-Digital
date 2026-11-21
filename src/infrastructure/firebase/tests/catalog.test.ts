import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore'
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createRulesEnvironment, profile, store } from './testConfig'
import { FirestoreCatalogUnitOfWork } from '../catalog/FirestoreCatalogUnitOfWork'
import { productFromDto } from '../catalog/catalogDto'
import { ManageProducts } from '../../../modules/products/application/ManageProducts'
import { RegisterProduct } from '../../../modules/products/application/RegisterProduct'
import { ManageCategories } from '../../../modules/categories/application/ManageCategories'
import type { ActorContext } from '../../../shared/domain/ActorContext'

let env: RulesTestEnvironment
// Sub-millisecond precision must survive category counter updates and product edits.
const stamp = new Timestamp(1788609600, 123456000)
const actor: ActorContext = { role: 'MERCHANT', storeId: 'store-a', actorId: 'merchant-a' }
const runtime = { now: () => new Date().toISOString(), nextId: () => randomUUID() }
const category = (storeId = 'store-a', id = 'category') => ({ id, storeId, name: 'Categoria DEMO', status: 'ACTIVE', createdAt: stamp, updatedAt: stamp, productCount: 0, catalogRevision: 0 })
const product = (id: string, storeId = 'store-a') => ({ id, storeId, name: 'Produto DEMO', description: '', priceCents: 1990, categoryId: 'category', stock: 0, status: 'ACTIVE', createdAt: stamp, updatedAt: stamp, catalogRevision: 0 })
const db = (uid = 'merchant-a') => env.authenticatedContext(uid).firestore() as unknown as Firestore
const unit = (firestore = db(), retry?: () => void) => new FirestoreCatalogUnitOfWork(firestore, 'store-a', retry)
const input = { storeId: 'store-a', name: 'Produto DEMO', description: 'Local', priceCents: 1990, categoryId: 'category' }

beforeAll(async () => { env = await createRulesEnvironment() })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const firestore = context.firestore()
    for (const id of ['a', 'b']) {
      await setDoc(doc(firestore, 'users', `merchant-${id}`), profile(`merchant-${id}`, 'MERCHANT', `store-${id}`))
      await setDoc(doc(firestore, 'stores', `store-${id}`), { ...store(`store-${id}`), usage: { productCount: 0, categoryCount: 1, revision: 0 }, catalogMutation: { kind: 'CATEGORY', id: 'category' } })
      await setDoc(doc(firestore, `stores/store-${id}/categories/category`), category(`store-${id}`))
    }
    await setDoc(doc(firestore, 'users/disabled'), profile('disabled', 'MERCHANT', 'store-a', 'DISABLED'))
    await setDoc(doc(firestore, 'users/master'), profile('master', 'MASTER', null))
  })
})
afterAll(async () => { await env.cleanup() })

async function fillProducts(count: number, archived = 0) {
  await env.withSecurityRulesDisabled(async context => {
    const firestore = context.firestore(), batch = writeBatch(firestore)
    for (let i = 0; i < count + archived; i++) batch.set(doc(firestore, `stores/store-a/products/p-${i}`), { ...product(`p-${i}`), status: i < count ? 'ACTIVE' : 'ARCHIVED' })
    batch.update(doc(firestore, 'stores/store-a'), { 'usage.productCount': count })
    batch.update(doc(firestore, 'stores/store-a/categories/category'), { productCount: count })
    await batch.commit()
  })
}
async function rawCreate(firestore: Firestore, id = 'raw', changes = {}) {
  const batch = writeBatch(firestore)
  batch.set(doc(firestore, `stores/store-a/products/${id}`), { ...product(id), catalogRevision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...changes })
  batch.update(doc(firestore, 'stores/store-a'), { usage: { productCount: 1, categoryCount: 1, revision: 1 }, catalogMutation: { kind: 'PRODUCT', id } })
  batch.update(doc(firestore, 'stores/store-a/categories/category'), { productCount: 1, catalogRevision: 1, updatedAt: serverTimestamp() })
  return batch.commit()
}

describe('catálogo Firestore real e regras adversariais', () => {
  it('salva/lê/lista por contrato, normaliza Timestamp e faz cópias defensivas', async () => {
    const uow = unit(), commands = new ManageProducts(uow, runtime)
    const created = await commands.create(actor, input)
    const read = await uow.run(tx => tx.products.get('store-a', created.id))
    expect(read?.priceCents).toBe(1990); expect(read?.createdAt).toMatch(/Z$/)
    read!.name = 'Ataque por referência'
    expect((await uow.run(tx => tx.products.list('store-a')))[0].name).toBe(input.name)
    expect((await getDoc(doc(db(), `stores/store-a/products/${created.id}`))).data()?.createdAt).toBeInstanceOf(Timestamp)
  })
  it('cadastro com estoque inicial cria exatamente um movimento na mesma transação', async () => {
    const created = await new RegisterProduct(unit(), runtime).execute(actor, { ...input, initialStock: 3, status: 'INACTIVE' })
    expect(created.stock).toBe(3); expect(created.status).toBe('INACTIVE')
    await env.withSecurityRulesDisabled(async context => {
      const movement = (await getDoc(doc(context.firestore(), `stores/store-a/stockMovements/${created.id}`))).data()
      expect(movement).toMatchObject({ type: 'MANUAL_ENTRY', quantity: 3, previousStock: 0, newStock: 3, createdBy: 'merchant-a' })
    })
  })
  it('preserva createdAt/id/storeId/stock ao editar e persiste nova leitura', async () => {
    const commands = new ManageProducts(unit(), runtime), created = await commands.create(actor, input)
    await env.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), `stores/store-a/products/${created.id}`), { createdAt: stamp })
    })
    const before = (await getDoc(doc(db(), `stores/store-a/products/${created.id}`))).data()!
    await commands.update(actor, 'store-a', created.id, { priceCents: 129990, name: 'Editado DEMO', status: 'INACTIVE' })
    const after = (await getDoc(doc(db(), `stores/store-a/products/${created.id}`))).data()!
    expect(after.createdAt.isEqual(before.createdAt)).toBe(true)
    expect(after.createdAt.isEqual(stamp)).toBe(true)
    expect(after).toMatchObject({ id: created.id, storeId: 'store-a', stock: 0, priceCents: 129990, name: 'Editado DEMO', status: 'INACTIVE' })
  })
  it('arquiva/reativa produto sem delete, liberando/restaurando os dois contadores', async () => {
    const uow = unit(), commands = new ManageProducts(uow, runtime), p = await commands.create(actor, input)
    await commands.update(actor, 'store-a', p.id, { status: 'ARCHIVED' })
    expect((await getDoc(doc(db(), 'stores/store-a'))).data()?.usage.productCount).toBe(0)
    await commands.update(actor, 'store-a', p.id, { status: 'ACTIVE' })
    expect((await getDoc(doc(db(), 'stores/store-a/categories/category'))).data()?.productCount).toBe(1)
  })
  it('troca categoria transfere productCount atomicamente', async () => {
    const uow = unit(), c = await new ManageCategories(uow, runtime).create(actor, { storeId: 'store-a', name: 'Nova DEMO' })
    const commands = new ManageProducts(uow, runtime), p = await commands.create(actor, input)
    await commands.update(actor, 'store-a', p.id, { categoryId: c.id })
    expect((await getDoc(doc(db(), 'stores/store-a/categories/category'))).data()?.productCount).toBe(0)
    expect((await getDoc(doc(db(), `stores/store-a/categories/${c.id}`))).data()?.productCount).toBe(1)
  })
  it('categoria renomeia, arquiva e reativa preservando documento', async () => {
    const commands = new ManageCategories(unit(), runtime)
    await commands.rename(actor, 'store-a', 'category', 'Nome DEMO')
    await commands.setStatus(actor, 'store-a', 'category', 'ARCHIVED')
    expect((await getDoc(doc(db(), 'stores/store-a'))).data()?.usage.categoryCount).toBe(0)
    await commands.setStatus(actor, 'store-a', 'category', 'ACTIVE')
    expect((await unit().run(tx => tx.categories.get('store-a', 'category')))?.name).toBe('Nome DEMO')
  })
  it('categoria em uso não arquiva pelo domínio nem por batch direto', async () => {
    await new ManageProducts(unit(), runtime).create(actor, input)
    await expect(new ManageCategories(unit(), runtime).setStatus(actor, 'store-a', 'category', 'ARCHIVED')).rejects.toMatchObject({ code: 'CATEGORY_IN_USE' })
    const firestore = db(), batch = writeBatch(firestore)
    batch.update(doc(firestore, 'stores/store-a/categories/category'), { status: 'ARCHIVED', catalogRevision: 2, updatedAt: serverTimestamp() })
    batch.update(doc(firestore, 'stores/store-a'), { usage: { productCount: 1, categoryCount: 0, revision: 2 }, catalogMutation: { kind: 'CATEGORY', id: 'category' } })
    await assertFails(batch.commit())
  })
  it('duas criações em 49: uma vence e outra falha, com retry real', async () => {
    await fillProducts(49)
    let retries = 0
    let arrived = 0
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const uow = unit(db(), () => { retries++ })
    const commands = new ManageProducts({ run: work => uow.run(async tx => {
      const result = await work(tx)
      if (++arrived === 2) release()
      await barrier
      return result
    }) }, runtime)
    const results = await Promise.allSettled([commands.create(actor, input), commands.create(actor, input)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(retries).toBeGreaterThan(0)
    expect((await getDoc(doc(db(), 'stores/store-a'))).data()?.usage.productCount).toBe(50)
    expect((await getDocs(collection(db(), 'stores/store-a/products'))).size).toBe(50)
  })
  it('reativações concorrentes no limite: somente uma vence', async () => {
    await fillProducts(49, 2)
    const commands = new ManageProducts(unit(), runtime)
    const results = await Promise.allSettled(['p-49', 'p-50'].map(id => commands.update(actor, 'store-a', id, { status: 'ACTIVE' })))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await getDoc(doc(db(), 'stores/store-a'))).data()?.usage.productCount).toBe(50)
  })
  it('categoria 5 para 6 falha; reativação também respeita cinco', async () => {
    const commands = new ManageCategories(unit(), runtime)
    for (let i = 0; i < 4; i++) await commands.create(actor, { storeId: 'store-a', name: `DEMO ${i}` })
    await expect(commands.create(actor, { storeId: 'store-a', name: 'Sexta' })).rejects.toMatchObject({ code: 'CATEGORY_LIMIT_REACHED' })
    await commands.setStatus(actor, 'store-a', 'category', 'ARCHIVED')
    await commands.create(actor, { storeId: 'store-a', name: 'Substituta' })
    await expect(commands.setStatus(actor, 'store-a', 'category', 'ACTIVE')).rejects.toMatchObject({ code: 'CATEGORY_LIMIT_REACHED' })
  })
  it('falha depois do insert faz rollback de produto, categoria e usage', async () => {
    await expect(unit().run(async tx => {
      await tx.products.insert({ ...input, id: 'rollback', status: 'ACTIVE', stock: 0, createdAt: runtime.now(), updatedAt: runtime.now() })
      throw new Error('Injected failure')
    })).rejects.toThrow('Injected failure')
    expect((await getDoc(doc(db(), 'stores/store-a/products/rollback'))).exists()).toBe(false)
    expect((await getDoc(doc(db(), 'stores/store-a'))).data()?.usage.productCount).toBe(0)
  })
  it('IDs iguais não colidem entre lojas; A não lê/atualiza/cria em B', async () => {
    await rawCreate(db(), 'same')
    const actorB: ActorContext = { role: 'MERCHANT', actorId: 'merchant-b', storeId: 'store-b' }
    const commandsB = new ManageProducts(new FirestoreCatalogUnitOfWork(db('merchant-b'), 'store-b'), { ...runtime, nextId: () => 'same' })
    await commandsB.create(actorB, { ...input, storeId: 'store-b', name: 'Produto B DEMO' })
    await assertFails(getDoc(doc(db(), 'stores/store-b/products/same')))
    await assertFails(updateDoc(doc(db(), 'stores/store-b/products/same'), { name: 'Ataque' }))
    await assertFails(setDoc(doc(db(), 'stores/store-b/products/injected'), product('injected', 'store-b')))
    expect((await getDoc(doc(db(), 'stores/store-a/products/same'))).data()?.name).toBe('Produto DEMO')
  })
  it.each([{ storeId: 'store-b' }, { owner: 'merchant-a' }, { priceCents: -1 }, { priceCents: 1.1 }, { stock: 1 }, { stock: -1 }, { stock: 1.5 }, { categoryId: 'missing' }])('payload de produto inválido %j é negado e não escreve parcialmente', async changes => {
    await assertFails(rawCreate(db(), 'invalid', changes))
    expect((await getDoc(doc(db(), 'stores/store-a'))).data()?.usage.productCount).toBe(0)
  })
  it.each(['disabled', 'master'])('%s não escreve catálogo', async uid => { await assertFails(rawCreate(db(uid))) })
  it('PUBLIC não lê ou escreve catálogo privado', async () => {
    const firestore = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDocs(collection(firestore, 'stores/store-a/products')))
    await assertFails(getDocs(collection(firestore, 'stores/store-a/categories')))
    await assertFails(rawCreate(firestore))
  })
  it('Store suspensa mantém leitura do Merchant e nega writes', async () => {
    await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'stores/store-a'), { status: 'SUSPENDED' }))
    expect((await getDocs(collection(db(), 'stores/store-a/categories'))).size).toBe(1)
    await assertFails(rawCreate(db()))
  })
  it.each(['planId', 'billingStatus', 'status', 'id', 'createdAt', 'slug', 'owner', 'whatsapp', 'usage', 'catalogMutation'])('Merchant não altera Store.%s isoladamente', async field => {
    await assertFails(updateDoc(doc(db(), 'stores/store-a'), { [field]: 'injected' }))
  })
  it('Minha Loja altera somente nome com updatedAt e preserva campos administrativos', async () => {
    await unit().renameStore('Nome local DEMO')
    expect((await getDoc(doc(db(), 'stores/store-a'))).data()).toMatchObject({ name: 'Nome local DEMO', planId: 'ats-loja-digital', status: 'ACTIVE', usage: { productCount: 0, categoryCount: 1, revision: 0 } })
  })
  it('não aceita dois produtos compartilhando um único incremento de usage', async () => {
    const firestore = db(), batch = writeBatch(firestore)
    for (const id of ['first', 'second']) batch.set(doc(firestore, `stores/store-a/products/${id}`), { ...product(id), catalogRevision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    batch.update(doc(firestore, 'stores/store-a'), { usage: { productCount: 1, categoryCount: 1, revision: 1 }, catalogMutation: { kind: 'PRODUCT', id: 'first' } })
    batch.update(doc(firestore, 'stores/store-a/categories/category'), { productCount: 1, catalogRevision: 1, updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
  })
  it('não aceita contador ou testemunha sem mutação, nem productCount direto', async () => {
    await assertFails(updateDoc(doc(db(), 'stores/store-a'), { usage: { productCount: 1, categoryCount: 1, revision: 1 }, catalogMutation: { kind: 'PRODUCT', id: 'missing' } }))
    await assertFails(updateDoc(doc(db(), 'stores/store-a/categories/category'), { productCount: 0, updatedAt: serverTimestamp(), catalogRevision: 1 }))
  })
  it('DTO rejeita vínculo falso, preço fracionário e timestamp inválido', () => {
    expect(() => productFromDto('p', 'store-a', product('p', 'store-b'))).toThrow()
    expect(() => productFromDto('p', 'store-a', { ...product('p'), priceCents: .1 })).toThrow()
    expect(() => productFromDto('p', 'store-a', { ...product('p'), createdAt: 'invalid' })).toThrow()
  })
  it('batch direto de 50 para 51 é negado pelas Rules', async () => {
    await fillProducts(50)
    const firestore = db(), batch = writeBatch(firestore)
    batch.set(doc(firestore, 'stores/store-a/products/excess'), { ...product('excess'), catalogRevision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    batch.update(doc(firestore, 'stores/store-a'), { usage: { productCount: 51, categoryCount: 1, revision: 1 }, catalogMutation: { kind: 'PRODUCT', id: 'excess' } })
    batch.update(doc(firestore, 'stores/store-a/categories/category'), { productCount: 51, catalogRevision: 1, updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
    expect((await getDocs(collection(firestore, 'stores/store-a/products'))).size).toBe(50)
  })
  it.each([{ storeId: 'store-b' }, { id: 'other' }, { createdAt: serverTimestamp() }, { stock: 5 }, { admin: true }])('adulteração de produto existente %j é negada com testemunha válida', async changes => {
    await rawCreate(db(), 'existing')
    const firestore = db(), batch = writeBatch(firestore)
    batch.update(doc(firestore, 'stores/store-a/products/existing'), { ...changes, catalogRevision: 2, updatedAt: serverTimestamp() })
    batch.update(doc(firestore, 'stores/store-a'), { usage: { productCount: 1, categoryCount: 1, revision: 2 }, catalogMutation: { kind: 'PRODUCT', id: 'existing' } })
    await assertFails(batch.commit())
  })
  it.each([{ storeId: 'store-b' }, { owner: 'attacker' }, { productCount: 1 }])('adulteração de categoria %j é negada', async changes => {
    const firestore = db(), batch = writeBatch(firestore)
    batch.update(doc(firestore, 'stores/store-a/categories/category'), { ...changes, catalogRevision: 1, updatedAt: serverTimestamp() })
    batch.update(doc(firestore, 'stores/store-a'), { usage: { productCount: 0, categoryCount: 1, revision: 1 }, catalogMutation: { kind: 'CATEGORY', id: 'category' } })
    await assertFails(batch.commit())
  })
  it('categoria B não permite leitura/escrita por A, e DISABLED não lê catálogo A', async () => {
    await assertFails(getDoc(doc(db(), 'stores/store-b/categories/category')))
    await assertFails(setDoc(doc(db(), 'stores/store-b/categories/foreign'), category('store-b', 'foreign')))
    await assertFails(getDocs(collection(db('disabled'), 'stores/store-a/products')))
    await assertFails(getDocs(collection(db('disabled'), 'stores/store-a/categories')))
  })
  it('duas categorias em cota quatro: exatamente uma criação vence', async () => {
    const commands = new ManageCategories(unit(), runtime)
    for (let i = 0; i < 3; i++) await commands.create(actor, { storeId: 'store-a', name: `DEMO ${i}` })
    const results = await Promise.allSettled([commands.create(actor, { storeId: 'store-a', name: 'A DEMO' }), commands.create(actor, { storeId: 'store-a', name: 'B DEMO' })])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await getDoc(doc(db(), 'stores/store-a'))).data()?.usage.categoryCount).toBe(5)
  })
  it('criação de produto versus arquivamento da categoria nunca deixa vínculo inválido', async () => {
    const uow = unit()
    const results = await Promise.allSettled([
      new ManageProducts(uow, runtime).create(actor, input),
      new ManageCategories(uow, runtime).setStatus(actor, 'store-a', 'category', 'ARCHIVED'),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const categoryData = (await getDoc(doc(db(), 'stores/store-a/categories/category'))).data()!
    expect(categoryData.status === 'ACTIVE' ? categoryData.productCount === 1 : categoryData.productCount === 0).toBe(true)
  })
  it('produto sem atualizar productCount da categoria causa rollback do batch', async () => {
    const firestore = db(), batch = writeBatch(firestore)
    batch.set(doc(firestore, 'stores/store-a/products/missing-counter'), { ...product('missing-counter'), catalogRevision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    batch.update(doc(firestore, 'stores/store-a'), { usage: { productCount: 1, categoryCount: 1, revision: 1 }, catalogMutation: { kind: 'PRODUCT', id: 'missing-counter' } })
    await assertFails(batch.commit())
    expect((await getDoc(doc(firestore, 'stores/store-a/products/missing-counter'))).exists()).toBe(false)
  })
})
