import type { Category } from '../domain/Category'
export interface CategoryRepository {
  get(storeId: string, id: string): Promise<Category | undefined>
  list(storeId: string): Promise<Category[]>
  insert(category: Category): Promise<void>
  update(storeId: string, category: Category): Promise<void>
}
