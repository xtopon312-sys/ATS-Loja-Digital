export interface StoreIdentity {
  id: string
  status: 'ACTIVE' | 'SUSPENDED'
}

export interface StoreIdentityRepository {
  getById(storeId: string): Promise<StoreIdentity | undefined>
}
