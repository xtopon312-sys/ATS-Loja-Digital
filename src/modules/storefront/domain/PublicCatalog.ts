import type { StoreThemeId } from '../../store-theme/domain/StoreTheme'

export interface PublicStore { whatsapp?: string; storeId: string; slug: string; name: string; themePreset: StoreThemeId; publishable: true }
export interface PublicCategory { id: string; storeId: string; name: string; publishable: boolean }
// imageUrl is a presentation slot for the future media adapter; current projections never emit it.
export interface PublicProduct { id: string; storeId: string; name: string; description: string; priceCents: number; categoryId: string; publishable: boolean; available: boolean; maxQuantity: number; imageUrl?: string }
export interface PublicCatalog { store: PublicStore; categories: PublicCategory[]; products: PublicProduct[] }
export type CatalogResult = { status: 'READY'; catalog: PublicCatalog } | { status: 'NOT_FOUND' | 'UNAVAILABLE' }
export interface PublicCatalogRepository { load(slug: string): Promise<CatalogResult> }

export function filterProducts(catalog: PublicCatalog, search: string, categoryId: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const term = normalize(search.trim())
  return catalog.products.filter(p => p.publishable && p.storeId === catalog.store.storeId
    && (!categoryId || p.categoryId === categoryId) && normalize(`${p.name} ${p.description}`).includes(term))
}
