import type { Product } from '../../../modules/products/domain/Product'
import type { Category } from '../../../modules/categories/domain/Category'
import type { PublicCategory, PublicProduct } from '../../../modules/storefront/domain/PublicCatalog'

export function publicProduct(product: Product): PublicProduct {
  const publishable = product.status === 'ACTIVE'
  const maxQuantity = !publishable ? 0 : product.stock >= 5 ? 5 : product.stock >= 2 ? 2 : product.stock >= 1 ? 1 : 0
  return { id: product.id, storeId: product.storeId, name: product.name, description: product.description,
    priceCents: product.priceCents, categoryId: product.categoryId, publishable, available: maxQuantity > 0, maxQuantity }
}
export function publicCategory(category: Category): PublicCategory {
  return { id: category.id, storeId: category.storeId, name: category.name, publishable: category.status === 'ACTIVE' }
}
