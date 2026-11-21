export interface Category {
  id: string
  storeId: string
  name: string
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
}
