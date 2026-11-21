import type { CategoryRepository } from '../../../modules/categories/application/CategoryRepository'
import type { Category } from '../../../modules/categories/domain/Category'
import { requireRule } from '../../../shared/domain/DomainError'
import { categoryFromDto, copy } from './catalogDto'

export class FirestoreCategoryRepository implements CategoryRepository {
  constructor(private storeId: string, private rows: Map<string, Category>, private writes: Set<string>, private guard: () => void) {}
  private scope(storeId: string) { this.guard(); requireRule(storeId === this.storeId, 'CROSS_STORE_ACCESS') }
  async get(storeId: string, id: string) { this.scope(storeId); return copy(this.rows.get(id)) }
  async list(storeId: string) { this.scope(storeId); return copy([...this.rows.values()]) }
  async insert(category: Category) {
    this.scope(category.storeId)
    requireRule(!this.rows.has(category.id), 'DUPLICATE_ID')
    const value = categoryFromDto(category.id, this.storeId, { ...category, productCount: 0 })
    this.rows.set(value.id, value); this.writes.add(value.id)
  }
  async update(storeId: string, category: Category) {
    this.scope(storeId)
    const original = this.rows.get(category.id)
    requireRule(original, 'CATEGORY_NOT_FOUND')
    requireRule(category.createdAt === original.createdAt, 'INVALID_INPUT')
    const value = categoryFromDto(category.id, this.storeId, { ...category, productCount: 0 })
    this.rows.set(value.id, value); this.writes.add(value.id)
  }
}
