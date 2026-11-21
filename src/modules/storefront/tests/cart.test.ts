import { describe, it, expect } from 'vitest'
import { decodeCart, encodeCart, reconcileCart, changeCart } from '../domain/Cart'
import { filterProducts, type PublicCatalog } from '../domain/PublicCatalog'
import { LocalCartStorage } from '../adapters/LocalCartStorage'

const catalog: PublicCatalog = { store: { storeId: 'a', slug: 'store-a', name: 'Store DEMO', themePreset: 'clean', publishable: true }, categories: [{ id: 'c', storeId: 'a', name: 'Categoria DEMO', publishable: true }], products: [
  { id: 'p', storeId: 'a', name: 'Produto Café DEMO', description: 'Descrição pesquisável', categoryId: 'c', priceCents: 1990, publishable: true, available: true, maxQuantity: 2 },
] }
describe('sacola pública por loja', () => {
  it('serializa somente IDs/quantidades com versão e storeId', () => {
    const raw = encodeCart('a', [{ productId: 'p', quantity: 2 }])
    expect(decodeCart(raw, 'a')).toEqual([{ productId: 'p', quantity: 2 }])
    expect(raw).not.toMatch(/price|name|role|actor|password/)
  })
  it.each([null, '', '{', 'null', '{}', '{"version":2,"storeId":"a","items":[]}', '{"version":1,"storeId":"b","items":[]}', 'x'.repeat(12001)])('descarta esquema inválido %s', raw => {
    expect(decodeCart(raw, 'a')).toEqual([])
  })
  it.each([0, -1, 1.5, 6, '2'])('descarta quantidade armazenada inválida %s', quantity => {
    expect(decodeCart(JSON.stringify({ version: 1, storeId: 'a', items: [{ productId: 'p', quantity }] }), 'a')).toEqual([])
  })
  it('rejeita campos extras e duplicatas persistidas', () => {
    expect(decodeCart(JSON.stringify({ version: 1, storeId: 'a', items: [{ productId: 'p', quantity: 1, priceCents: 1 }] }), 'a')).toEqual([])
    expect(decodeCart(encodeCart('a', [{ productId: 'p', quantity: 1 }, { productId: 'p', quantity: 1 }]), 'a')).toEqual([])
  })
  it('adiciona/incrementa/limita/diminui/remove sem tocar catálogo', () => {
    const snapshot = structuredClone(catalog)
    let cart = changeCart([], catalog, 'p', 1)
    expect(cart.subtotalCents).toBe(1990)
    cart = changeCart(cart.items, catalog, 'p', 99)
    expect(cart.quantity).toBe(2); expect(cart.subtotalCents).toBe(3980)
    cart = changeCart(cart.items, catalog, 'p', 1)
    expect(cart.quantity).toBe(1)
    expect(changeCart(cart.items, catalog, 'p', 0).items).toEqual([])
    expect(catalog).toEqual(snapshot)
  })
  it('reconcilia preço/nome atuais e teto reduzido', () => {
    const changed = structuredClone(catalog)
    changed.products[0] = { ...changed.products[0], name: 'Novo nome', priceCents: 2990, maxQuantity: 1 }
    const cart = reconcileCart([{ productId: 'p', quantity: 2 }], changed)
    expect(cart.subtotalCents).toBe(2990); expect(cart.lines[0].product.name).toBe('Novo nome'); expect(cart.quantity).toBe(1)
  })
  it.each([{ products: [] }, { products: [{ ...catalog.products[0], available: false, maxQuantity: 0 }] }, { products: [{ ...catalog.products[0], publishable: false }] }, { products: [{ ...catalog.products[0], storeId: 'b' }] }])('remove produto ausente/inativo/sem saldo/estrangeiro', change => {
    expect(reconcileCart([{ productId: 'p', quantity: 2 }], { ...catalog, ...change }).items).toEqual([])
  })
  it('subtotal nunca ultrapassa inteiros seguros', () => {
    const huge = { ...catalog, products: [{ ...catalog.products[0], priceCents: Number.MAX_SAFE_INTEGER }] }
    expect(reconcileCart([{ productId: 'p', quantity: 2 }], huge).subtotalCents).toBe(0)
  })
  it('busca sem acento por nome/descrição combina com categoria', () => {
    expect(filterProducts(catalog, 'CAFE', 'c')).toHaveLength(1)
    expect(filterProducts(catalog, 'pesquisavel', '')).toHaveLength(1)
    expect(filterProducts(catalog, '', 'missing')).toEqual([])
  })
  it('localStorage separa lojas e suporta falha de armazenamento', () => {
    const memory = new Map<string, string>(), storage = new LocalCartStorage({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value) } })
    storage.write('a', [{ productId: 'p', quantity: 2 }]); expect(storage.read('b').items).toEqual([])
    expect(storage.read('a').items[0].quantity).toBe(2)
    const failed = new LocalCartStorage({ getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(failed.read('a').failed).toBe(true); expect(failed.write('a', [])).toBe(false)
  })
})
