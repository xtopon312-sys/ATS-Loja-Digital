import type { Store } from '../domain/Store'
export interface StoreRepository {
  get(id: string): Promise<Store | undefined>
  /** Atomically unique normalized slug and id; never upsert. */
  insert(store: Store): Promise<void>
}
