import { requireRule } from '../../../shared/domain/DomainError'
import type { CatalogTransaction as Transaction } from './CatalogUnitOfWork'

export async function operationalStore(tx: Transaction, storeId: string) {
  const store = await tx.stores.get(storeId)
  requireRule(store, 'STORE_NOT_FOUND')
  requireRule(store.status === 'ACTIVE', 'STORE_SUSPENDED')
  return store
}
export async function storePlan(tx: Transaction, storeId: string) {
  const store = await operationalStore(tx, storeId)
  const plan = await tx.plans.get(store.planId)
  requireRule(plan, 'PLAN_NOT_FOUND')
  return plan
}
export async function activeCategory(tx: Transaction, storeId: string, id: string) {
  const category = await tx.categories.get(storeId, id)
  requireRule(category, 'CATEGORY_NOT_FOUND')
  requireRule(category.storeId === storeId, 'CROSS_STORE_ACCESS')
  requireRule(category.status === 'ACTIVE', 'CATEGORY_NOT_FOUND')
}
