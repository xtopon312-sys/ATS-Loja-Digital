import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export interface Product {
  id: string
  storeId: string
  name: string
  description: string
  priceCents: number
  categoryId: string
  stock: number
  status: ProductStatus
  createdAt: string
  updatedAt: string
}

export function validateProduct(product: Product): void {
  nonempty(product.id)
  nonempty(product.storeId)
  nonempty(product.name)
  integer(product.priceCents, 0, 'INVALID_PRICE')
  integer(product.stock, 0, 'INVALID_STOCK')
  requireRule(['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(product.status), 'INVALID_INPUT')
}
