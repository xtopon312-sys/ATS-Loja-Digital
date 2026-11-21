import type { UserProfile } from '../domain/UserProfile'

export interface UserProfileRepository {
  getByUid(uid: string): Promise<UserProfile | undefined>
}
