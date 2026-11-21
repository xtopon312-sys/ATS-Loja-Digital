import type { ActorContext } from '../../../shared/domain/ActorContext'
import { requireRule } from '../../../shared/domain/DomainError'
import type { StoreIdentityRepository } from './StoreIdentityRepository'
import type { UserProfileRepository } from './UserProfileRepository'

export class ResolveActorContext {
  constructor(private profiles: UserProfileRepository, private stores: StoreIdentityRepository) {}

  async execute(uid: string): Promise<Exclude<ActorContext, { role: 'PUBLIC' }>> {
    const profile = await this.profiles.getByUid(uid)
    requireRule(profile?.status === 'ACTIVE', 'ACCESS_DENIED')
    if (profile.role === 'MASTER') return { actorId: profile.uid, role: 'MASTER' }
    const store = await this.stores.getById(profile.storeId)
    requireRule(store?.id === profile.storeId, 'ACCESS_DENIED')
    return { actorId: profile.uid, role: 'MERCHANT', storeId: profile.storeId }
  }
}
