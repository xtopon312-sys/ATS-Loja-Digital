import { Timestamp, type DocumentData } from 'firebase/firestore'
import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'
import { validateProduct, type Product } from '../../../modules/products/domain/Product'
import type { Category } from '../../../modules/categories/domain/Category'
import type { Store } from '../../../modules/stores/domain/Store'

export const copy = <T>(value: T): T => structuredClone(value)
export function documentId(id: string): string {
  requireRule(typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id), 'INVALID_INPUT')
  return id
}
export function iso(value: unknown): string {
  const result = value instanceof Timestamp ? value.toDate().toISOString() : value
  requireRule(typeof result === 'string' && Number.isFinite(Date.parse(result)), 'INVALID_INPUT')
  return new Date(result).toISOString()
}
export function productFromDto(id: string, storeId: string, data: DocumentData): Product {
  requireRule(data.id === id && data.storeId === storeId, 'CROSS_STORE_ACCESS')
  const product: Product = {
    id: documentId(id), storeId: documentId(storeId), name: data.name, description: data.description,
    priceCents: data.priceCents, categoryId: documentId(data.categoryId), stock: data.stock,
    status: data.status, createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt),
  }
  validateProduct(product)
  requireRule(product.name.trim().length <= 120 && typeof product.description === 'string' && product.description.length <= 2000, 'INVALID_INPUT')
  return product
}
export function categoryFromDto(id: string, storeId: string, data: DocumentData): Category {
  requireRule(data.id === id && data.storeId === storeId, 'CROSS_STORE_ACCESS')
  requireRule(['ACTIVE', 'ARCHIVED'].includes(data.status), 'INVALID_INPUT')
  const name = nonempty(data.name)
  requireRule(name.length <= 120, 'INVALID_INPUT')
  integer(data.productCount, 0, 'INVALID_INPUT')
  return { id: documentId(id), storeId: documentId(storeId), name, status: data.status, createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt) }
}
export function storeFromDto(id: string, data: DocumentData): Store {
  requireRule(id === data.id, 'CROSS_STORE_ACCESS')
  requireRule(data.whatsapp === undefined || typeof data.whatsapp === 'string'
    && (data.whatsapp === '' || /^[1-9]\d{9,14}$/.test(data.whatsapp)), 'INVALID_INPUT')
  requireRule(['ACTIVE', 'SUSPENDED'].includes(data.status) && ['PAID', 'PENDING', 'OVERDUE'].includes(data.billingStatus), 'INVALID_INPUT')
  return { id: documentId(id), name: nonempty(data.name), slug: nonempty(data.slug), status: data.status,
    ...(data.whatsapp === undefined ? {} : { whatsapp: data.whatsapp as string }), planId: nonempty(data.planId), billingStatus: data.billingStatus, createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt) }
}
