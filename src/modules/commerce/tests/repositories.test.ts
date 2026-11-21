import { describe, expect, it } from 'vitest'
import { InMemoryUnitOfWork } from '../adapters/InMemoryUnitOfWork'
import type { Transaction, UnitOfWork } from '../application/UnitOfWork'
import { category, commands, fixture, master, merchant, orderInput, product, productInput, store } from './fixtures'

describe('in-memory repository contracts', () => {
  it('caller mutation after authorization cannot move a queued product creation to another store', async () => {
    const f = fixture([])
    const input = { ...productInput }
    const pending = f.products.create(merchant, input)
    input.storeId = 'b'
    const created = await pending
    expect(created.storeId).toBe('a')
    expect(await f.db.run(tx => tx.products.list('b'))).toEqual([])
  })
  it('caller mutation cannot retarget a queued adjustment or change its quantity', async () => {
    const f = fixture([product('p', 5), product('p', 10, 'b')])
    const input = { storeId: 'a', productId: 'p', type: 'MANUAL_ENTRY' as const, quantity: 2, reason: 'Test', idempotencyKey: 'immutable' }
    const pending = f.adjust.execute(merchant, input)
    input.storeId = 'b'
    input.quantity = 100
    await pending
    expect((await f.readProduct())?.stock).toBe(7)
    expect((await f.readProduct('p', 'b'))?.stock).toBe(10)
  })
  it('same product/category/order ids in distinct stores never overwrite each other', async () => {
    const f = fixture([product('p', 5), product('p', 8, 'b')])
    const orderA = await f.create.execute(orderInput())
    const orderB = { ...orderA, storeId: 'b', customer: { name: 'B' } }
    await f.db.run(tx => tx.orders.insert(orderB))
    await f.products.update(master, 'b', 'p', { name: 'B product' })
    await f.confirm.execute(merchant, 'a', orderA.id)
    expect((await f.readProduct())?.stock).toBe(4)
    expect((await f.readProduct('p', 'b'))?.stock).toBe(8)
    expect((await f.readProduct())?.name).toBe('Product p')
    expect((await f.readOrder(orderA.id, 'b'))?.status).toBe('PENDING')
    await f.db.run(async tx => {
      await tx.categories.update('b', { ...category('c', 'b'), name: 'B category' })
      expect((await tx.categories.get('a', 'c'))?.name).toBe('Category c')
    })
    expect(await f.movements('b')).toEqual([])
  })
  it('creation idempotency keys are scoped to store', async () => {
    const f = fixture([product('p', 5), product('p', 5, 'b')])
    const a = await f.create.execute(orderInput('same'))
    const b = await f.create.execute(orderInput('same', 'p', 1, 'b'))
    expect(a.id).not.toBe(b.id)
    expect(a.storeId).toBe('a')
    expect(b.storeId).toBe('b')
  })
  it('rejects storeId changes on all scoped mutable repositories', async () => {
    const f = fixture()
    const o = await f.create.execute(orderInput())
    await expect(f.db.run(tx => tx.products.update('a', product('p', 5, 'b')))).rejects.toMatchObject({ code: 'CROSS_STORE_ACCESS' })
    await expect(f.db.run(tx => tx.categories.update('a', category('c', 'b')))).rejects.toMatchObject({ code: 'CROSS_STORE_ACCESS' })
    await expect(f.db.run(tx => tx.orders.update('a', { ...o, storeId: 'b' }))).rejects.toMatchObject({ code: 'CROSS_STORE_ACCESS' })
  })
  it('defensively copies constructor seeds, returned products, nested orders, plans and lists', async () => {
    const seedProduct = product('p', 5)
    const f = fixture([seedProduct])
    seedProduct.stock = 999
    const o = await f.create.execute(orderInput())
    o.items[0].name = 'Mutated'
    o.customer.name = 'Mutated'
    const p = (await f.readProduct())!
    p.stock = 999
    await f.db.run(async tx => {
      const products = await tx.products.list('a')
      products[0].name = 'Mutated'
      const plans = (await tx.plans.get(store().planId))!
      plans.limits.maxProducts = 999
      const categories = await tx.categories.list('a')
      categories[0].name = 'Mutated'
      const s = (await tx.stores.get('a'))!
      s.name = 'Mutated'
    })
    expect((await f.readProduct())?.stock).toBe(5)
    expect((await f.readProduct())?.name).toBe('Product p')
    expect((await f.readOrder(o.id))?.items[0].name).toBe('Product p')
    expect((await f.readOrder(o.id))?.customer.name).toBe('Test customer')
    await f.db.run(async tx => {
      expect((await tx.categories.get('a', 'c'))?.name).toBe('Category c')
      expect((await tx.plans.get(store().planId))?.limits.maxProducts).toBe(50)
      expect((await tx.stores.get('a'))?.name).toBe('Store a')
    })
  })
  it('defensively copies inserted/updated data even before commit', async () => {
    const f = fixture([])
    await f.db.run(async tx => {
      const p = product()
      await tx.products.insert(p)
      p.name = 'Mutated'
      const c = category('new')
      await tx.categories.insert(c)
      c.name = 'Mutated'
      const update = (await tx.products.get('a', 'p'))!
      update.name = 'Intended'
      await tx.products.update('a', update)
      update.name = 'Mutated again'
    })
    expect((await f.readProduct())?.name).toBe('Intended')
    expect((await f.db.run(tx => tx.categories.get('a', 'new')))?.name).toBe('Category new')
  })
  it('movement records are detached and expose no update/delete operations', async () => {
    const f = fixture()
    const o = await f.create.execute(orderInput())
    await f.confirm.execute(merchant, 'a', o.id)
    const list = await f.movements()
    list[0].quantity = 500
    expect((await f.movements())[0].quantity).toBe(1)
    await f.db.run(async tx => {
      expect(Object.keys(tx.stockMovements).sort()).toEqual(['append', 'findByIdempotencyKey', 'list', 'listByOrder'])
      const scoped = await tx.stockMovements.listByOrder('a', o.id)
      const found = await tx.stockMovements.findByIdempotencyKey('a', scoped[0].idempotencyKey)
      expect(found?.id).toBe(scoped[0].id)
      scoped[0].quantity = 500
      expect((await tx.stockMovements.listByOrder('a', o.id))[0].quantity).toBe(1)
    })
  })
  it('rejects arbitrary stock updates without matching ledger entries', async () => {
    const f = fixture()
    await expect(f.db.run(tx => tx.products.update('a', product('p', 8)))).rejects.toMatchObject({ code: 'INVALID_STOCK_HISTORY' })
    expect((await f.readProduct())?.stock).toBe(5)
    await expect(f.db.run(tx => tx.products.insert(product('new', 1)))).rejects.toMatchObject({ code: 'INVALID_STOCK_HISTORY' })
    expect(await f.readProduct('new')).toBeUndefined()
  })
  it('rejects duplicate ids instead of upserting', async () => {
    const f = fixture()
    await expect(f.db.run(tx => tx.products.insert(product()))).rejects.toMatchObject({ code: 'DUPLICATE_ID' })
    await expect(f.db.run(tx => tx.categories.insert(category()))).rejects.toMatchObject({ code: 'DUPLICATE_ID' })
    const o = await f.create.execute(orderInput())
    await expect(f.db.run(tx => tx.orders.insert(o))).rejects.toMatchObject({ code: 'DUPLICATE_ID' })
  })
  it('transaction-scoped ports close after commit or rollback', async () => {
    const f = fixture()
    let escaped!: Transaction
    await f.db.run(async tx => { escaped = tx })
    await expect(escaped.products.get('a', 'p')).rejects.toMatchObject({ code: 'TRANSACTION_CLOSED' })
    await expect(f.db.run(async tx => { escaped = tx; throw new Error('abort') })).rejects.toThrow('abort')
    await expect(escaped.categories.insert(category('late'))).rejects.toMatchObject({ code: 'TRANSACTION_CLOSED' })
  })
  it('rolls back writes on exceptions and continues accepting transactions', async () => {
    const f = fixture()
    await expect(f.db.run(async tx => {
      await tx.products.update('a', { ...product('p', 5), name: 'Should roll back' })
      throw new Error('abort')
    })).rejects.toThrow('abort')
    expect((await f.readProduct())?.name).toBe('Product p')
  })
  it('rejects order snapshot changes at repository update', async () => {
    const f = fixture()
    const o = await f.create.execute(orderInput())
    await expect(f.db.run(tx => tx.orders.update('a', { ...o, totalCents: 1 }))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('domain independently rejects a contract-breaking adapter returning foreign products', async () => {
    const f = fixture()
    const wrong: UnitOfWork = { run: work => f.db.run(tx => work({ ...tx, products: { ...tx.products,
      get: async () => product('p', 5, 'b') } })) }
    await expect(commands(wrong, f.runtime).create.execute(orderInput())).rejects.toMatchObject({ code: 'CROSS_STORE_ACCESS' })
    const o = await f.create.execute(orderInput())
    await expect(commands(wrong, f.runtime).confirm.execute(merchant, 'a', o.id)).rejects.toMatchObject({ code: 'CROSS_STORE_ACCESS' })
    expect((await f.readProduct())?.stock).toBe(5)
    expect(await f.movements()).toEqual([])
  })
  it('rejects duplicate store seed ids and normalized slugs', () => {
    expect(() => new InMemoryUnitOfWork({ stores: [store(), store()] })).toThrow(expect.objectContaining({ code: 'DUPLICATE_ID' }))
    expect(() => new InMemoryUnitOfWork({ stores: [store(), { ...store('b'), slug: 'STORE-A' }] })).toThrow(expect.objectContaining({ code: 'SLUG_IN_USE' }))
  })
})
