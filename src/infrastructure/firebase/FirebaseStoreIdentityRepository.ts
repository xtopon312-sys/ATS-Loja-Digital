import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { requireRule } from '../../shared/domain/DomainError'
import type { StoreIdentity, StoreIdentityRepository } from '../../modules/auth/application/StoreIdentityRepository'

export class FirebaseStoreIdentityRepository implements StoreIdentityRepository {
  constructor(private firestore: Firestore) {}

  async getById(storeId: string): Promise<StoreIdentity | undefined> {
    const snapshot = await getDoc(doc(this.firestore, 'stores', storeId))
    if (!snapshot.exists()) return undefined
    const value = snapshot.data()
    requireRule(value.id === storeId, 'ACCESS_DENIED')
    requireRule(value.status === 'ACTIVE' || value.status === 'SUSPENDED', 'ACCESS_DENIED')
    return { id: storeId, status: value.status }
  }
}
