import { describe, expect, it } from 'vitest'
import { checkoutCustomer, normalizedPhone, whatsappLink, type OrderReceipt } from '../application/Checkout'
import { decodeCheckoutSession, type CheckoutSession } from '../application/CheckoutSession'
const receipt: OrderReceipt = { id: 'order-demo', storeId: 'store-demo', storeName: 'Loja DEMO', whatsapp: '15555550101',
  items: [{ productId: 'p1', name: 'Ação & café DEMO', quantity: 2, unitPriceCents: 1990, subtotalCents: 3980 },
    { productId: 'p2', name: 'Especial DEMO', quantity: 1, unitPriceCents: 129990, subtotalCents: 129990 }],
  totalCents: 133970, customer: { name: 'José DEMO', phone: '15555550102', note: 'Azul + branco? 50% & mais' }, createdAt: '2026-09-05T12:00:00.000Z' }
const session: CheckoutSession = { version: 1, storeId: 'store-demo', input: { slug: 'store-demo', items: [{ productId: 'p1', quantity: 2 }],
  customer: receipt.customer, idempotencyKey: '11111111-1111-4111-8111-111111111111' }, receipt }
describe('checkout boundary and WhatsApp', () => {
  it('encodes accents, symbols, quantities, BRL prices and code without confirming a sale', () => {
    const url = new URL(whatsappLink(receipt)), text = url.searchParams.get('text')!
    expect(url.origin).toBe('https://wa.me'); expect(url.pathname).toBe('/15555550101')
    for (const part of ['order-demo', 'José DEMO', '2 × Ação & café DEMO', 'Azul + branco? 50% & mais', '1.339,70', 'Não há reserva']) expect(text).toContain(part)
    expect(whatsappLink(receipt)).toContain('%26'); expect(whatsappLink(receipt)).toContain('%0A')
  })
  it('supports no note and zero-priced items', () => {
    const url = whatsappLink({ ...receipt, customer: { name: 'DEMO' }, totalCents: 0, items: [{ ...receipt.items[0], unitPriceCents: 0, subtotalCents: 0 }] })
    expect(new URL(url).searchParams.get('text')).toContain('0,00'); expect(url).not.toContain('Observa')
  })
  it('normalizes formatted international telephone', () => { expect(normalizedPhone('+1 (555) 555-0101')).toBe('15555550101') })
  it.each(['123', '-123', 'abc', '00000000000', '1'.repeat(16)])('rejects invalid phone %s', value => { expect(() => normalizedPhone(value)).toThrow() })
  it('trims minimal customer fields', () => { expect(checkoutCustomer({ name: ' DEMO ', phone: '+1 5555550102', note: ' Teste ' })).toEqual({ name: 'DEMO', phone: '15555550102', note: 'Teste' }) })
  it.each(['<script>', 'a\nb', 'a\u0000b', 'x'.repeat(121), '  '])('rejects invalid customer name %s', name => { expect(() => checkoutCustomer({ name, phone: receipt.whatsapp })).toThrow() })
  it('restores a validated session and successful receipt', () => { expect(decodeCheckoutSession(JSON.stringify(session), 'store-demo', 'store-demo')).toEqual(session) })
  it.each([null, '{', '{}', 'null', 'x'.repeat(25000)])('discards corrupted session %s', raw => { expect(decodeCheckoutSession(raw, 'store-demo', 'store-demo')).toBeUndefined() })
  it('does not reuse another Store or slug session', () => {
    expect(decodeCheckoutSession(JSON.stringify(session), 'other', 'store-demo')).toBeUndefined()
    expect(decodeCheckoutSession(JSON.stringify(session), 'store-demo', 'other')).toBeUndefined()
  })
  it.each([{ version: 2 }, { role: 'MASTER' }, { receipt: { ...receipt, totalCents: 1 } }, { receipt: { ...receipt, whatsapp: 'javascript:bad' } }])('rejects forged persisted session %j', value => {
    expect(decodeCheckoutSession(JSON.stringify({ ...session, ...value }), 'store-demo', 'store-demo')).toBeUndefined()
  })
})
