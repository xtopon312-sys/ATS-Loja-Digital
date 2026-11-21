import { describe, expect, it } from 'vitest'
import { validateProduct } from '../../products/domain/Product'
import { INITIAL_PLAN } from '../../plans/domain/Plan'
import { normalizeSlug } from '../../stores/domain/Store'
import { category, fixture, master, merchant, product, productInput, publicActor, store } from './fixtures'

describe('catalog domain invariants', () => {
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects price %s', async priceCents => {
    const f = fixture()
    await expect(f.products.create(merchant, { ...productInput, priceCents })).rejects.toMatchObject({ code: 'INVALID_PRICE' })
  })
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects stock %s', stock => {
    expect(() => validateProduct(product('p', stock))).toThrow(expect.objectContaining({ code: 'INVALID_STOCK' }))
  })
  it('allows zero price and initializes stock at zero without movement', async () => {
    const f = fixture([])
    const p = await f.products.create(merchant, { ...productInput, priceCents: 0 })
    expect(p).toMatchObject({ stock: 0, priceCents: 0, storeId: 'a' })
    expect(await f.movements()).toEqual([])
  })
  it('allows 49 to 50 and denies 50 to 51 including inactive products', async () => {
    const f = fixture(Array.from({ length: 49 }, (_, i) => ({ ...product(`p${i}`), status: 'INACTIVE' })))
    await f.products.create(merchant, productInput)
    await expect(f.products.create(merchant, productInput)).rejects.toMatchObject({ code: 'PRODUCT_LIMIT_REACHED' })
    expect(await f.db.run(tx => tx.products.list('a'))).toHaveLength(50)
  })
  it('archived products do not count; reactivation to inactive respects the quota', async () => {
    const f = fixture([...Array.from({ length: 49 }, (_, i) => product(`p${i}`)), { ...product('archived'), status: 'ARCHIVED' }])
    await f.products.create(merchant, productInput)
    await expect(f.products.update(merchant, 'a', 'archived', { status: 'INACTIVE' })).rejects.toMatchObject({ code: 'PRODUCT_LIMIT_REACHED' })
    await f.products.update(merchant, 'a', 'p0', { status: 'ARCHIVED' })
    expect(await f.products.update(merchant, 'a', 'archived', { status: 'ACTIVE' })).toMatchObject({ status: 'ACTIVE' })
  })
  it('serializes concurrent creations at product quota', async () => {
    const f = fixture(Array.from({ length: 49 }, (_, i) => product(`p${i}`)))
    const results = await Promise.allSettled([f.products.create(merchant, productInput), f.products.create(merchant, productInput)])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
  })
  it('rejects category 5 to 6 and reactivation at the limit', async () => {
    const f = fixture([], { categories: [...Array.from({ length: 5 }, (_, i) => category(`c${i}`)), { ...category('old'), status: 'ARCHIVED' }] })
    await expect(f.categories.create(merchant, { storeId: 'a', name: 'Sixth' })).rejects.toMatchObject({ code: 'CATEGORY_LIMIT_REACHED' })
    await expect(f.categories.setStatus(merchant, 'a', 'old', 'ACTIVE')).rejects.toMatchObject({ code: 'CATEGORY_LIMIT_REACHED' })
    await f.categories.setStatus(merchant, 'a', 'c0', 'ARCHIVED')
    expect(await f.categories.setStatus(merchant, 'a', 'old', 'ACTIVE')).toMatchObject({ status: 'ACTIVE' })
  })
  it.each(['ACTIVE', 'INACTIVE'] as const)('category in use by %s product cannot be archived', async status => {
    const f = fixture([{ ...product(), status }])
    await expect(f.categories.setStatus(merchant, 'a', 'c', 'ARCHIVED')).rejects.toMatchObject({ code: 'CATEGORY_IN_USE' })
  })
  it('category may archive after product archive; product reactivation requires active category', async () => {
    const f = fixture([{ ...product(), status: 'ARCHIVED' }])
    await f.categories.setStatus(merchant, 'a', 'c', 'ARCHIVED')
    await expect(f.products.update(merchant, 'a', 'p', { status: 'ACTIVE' })).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' })
  })
  it('serializes concurrent category quota checks', async () => {
    const f = fixture([], { categories: Array.from({ length: 4 }, (_, i) => category(`c${i}`)) })
    const results = await Promise.allSettled([1, 2].map(() => f.categories.create(merchant, { storeId: 'a', name: 'Test' })))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await f.db.run(tx => tx.categories.list('a'))).toHaveLength(5)
  })
  it('cannot assign a foreign category', async () => {
    const f = fixture([], { categories: [category('foreign', 'b')] })
    await expect(f.products.create(merchant, { ...productInput, categoryId: 'foreign' })).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' })
  })
  it('archiving cannot be used to assign an unknown or foreign category', async () => {
    const f = fixture()
    await expect(f.products.update(merchant, 'a', 'p', { status: 'ARCHIVED', categoryId: 'foreign' })).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' })
    expect((await f.readProduct())?.status).toBe('ACTIVE')
  })
  it('rejects public and merchant cross-store administration', async () => {
    const f = fixture()
    await expect(async () => f.products.create(publicActor, productInput)).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
    await expect(async () => f.products.create(merchant, { ...productInput, storeId: 'b' })).rejects.toMatchObject({ code: 'CROSS_STORE_ACCESS' })
  })
  it('ignores unapproved stock/storeId fields on product updates', async () => {
    const f = fixture()
    const changes = { name: 'Changed', stock: 999, storeId: 'b' }
    expect(await f.products.update(merchant, 'a', 'p', changes)).toMatchObject({ stock: 5, storeId: 'a' })
  })
  it('normalizes slug and enforces global uniqueness atomically', async () => {
    const f = fixture()
    expect(normalizeSlug('  Loja São João  ')).toBe('loja-sao-joao')
    const results = await Promise.allSettled([1, 2].map(() => f.stores.execute(master, { slug: 'Loja Teste', name: 'Test' })))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'SLUG_IN_USE' } })
  })
  it.each(['a', '../shop', 'a/b', '-abc', 'abc-', 'a--b', 'x'.repeat(64)])('rejects invalid slug %s', slug => {
    expect(() => normalizeSlug(slug)).toThrow(expect.objectContaining({ code: 'INVALID_SLUG' }))
  })
  it('only master can create a store', async () => {
    await expect(async () => fixture().stores.execute(merchant, { slug: 'new-store', name: 'Test' })).rejects.toMatchObject({ code: 'ACCESS_DENIED' })
  })
  it('initial plan contains only ATS definition and is immutable', () => {
    expect(INITIAL_PLAN).toMatchObject({ name: 'ATS Loja Digital', priceCents: 10000, currency: 'BRL', interval: 'MONTH', limits: { maxProducts: 50, maxCategories: 5 } })
    expect(INITIAL_PLAN.capabilities).toEqual(['products', 'categories', 'orders', 'inventory', 'whatsappCheckout', 'branding'])
    expect(Object.isFrozen(INITIAL_PLAN.limits)).toBe(true)
  })
  it('suspended store cannot create catalog records; overdue is not automatic suspension', async () => {
    const f = fixture([], { stores: [{ ...store(), status: 'SUSPENDED' }] })
    await expect(f.products.create(merchant, productInput)).rejects.toMatchObject({ code: 'STORE_SUSPENDED' })
    const overdue = fixture([], { stores: [{ ...store(), billingStatus: 'OVERDUE' }] })
    await expect(overdue.products.create(merchant, productInput)).resolves.toMatchObject({ storeId: 'a' })
  })
})
