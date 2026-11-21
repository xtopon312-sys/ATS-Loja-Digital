import { requireRule } from '../../../shared/domain/DomainError'
import type { Customer, OrderItem } from '../domain/Order'

export interface CheckoutInput { slug: string; items: { productId: string; quantity: number }[]; customer: Customer; idempotencyKey: string }
export interface OrderReceipt { id: string; storeId: string; storeName: string; whatsapp: string; items: OrderItem[]; totalCents: number; customer: Customer; createdAt: string }
export interface CheckoutGateway { createPendingOrder(input: CheckoutInput): Promise<OrderReceipt> }

/** Only explicit transactional rejections prove that this attempt did not commit. Transport failures do not. */
export function commandWasRejected(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && ['INVALID_INPUT', 'INVALID_QUANTITY', 'PRODUCT_UNAVAILABLE', 'PRODUCT_NOT_FOUND', 'STORE_NOT_FOUND',
      'STORE_SUSPENDED', 'INSUFFICIENT_STOCK', 'ACCESS_DENIED', 'CROSS_STORE_ACCESS'].includes(String(error.code))
}

export function normalizedPhone(value: string): string {
  requireRule(typeof value === 'string' && /^[+()\d\s-]*$/.test(value) && value.length <= 32, 'INVALID_INPUT')
  const phone = value.replace(/\D/g, '')
  requireRule(/^[1-9]\d{9,14}$/.test(phone), 'INVALID_INPUT')
  return phone
}
export function customerText(value: string, max: number): string {
  requireRule(typeof value === 'string', 'INVALID_INPUT')
  const result = value.trim()
  requireRule(result.length > 0 && result.length <= max && !/[<>]/.test(result)
    && ![...result].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127), 'INVALID_INPUT')
  return result
}
export function checkoutCustomer(customer: Customer): Customer {
  return { name: customerText(customer.name, 120), phone: normalizedPhone(customer.phone ?? ''),
    ...(customer.note?.trim() ? { note: customerText(customer.note, 500) } : {}) }
}
export function whatsappLink(receipt: OrderReceipt): string {
  const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
  const message = [`Pedido ${receipt.id}`, receipt.storeName, `Cliente: ${receipt.customer.name}`,
    ...receipt.items.map(item => `${item.quantity} × ${item.name} — ${money(item.unitPriceCents)} cada — ${money(item.subtotalCents)}`),
    `Total: ${money(receipt.totalCents)}`, ...(receipt.customer.note ? [`Observação: ${receipt.customer.note}`] : []),
    'Pedido pendente de confirmação pela loja. Não há reserva de estoque.'].join('\n')
  return `https://wa.me/${normalizedPhone(receipt.whatsapp)}?text=${encodeURIComponent(message)}`
}
