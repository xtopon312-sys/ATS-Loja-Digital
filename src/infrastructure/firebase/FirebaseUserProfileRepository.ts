import { doc, getDoc, type Firestore } from 'firebase/firestore'
import type { UserProfileRepository } from '../../modules/auth/application/UserProfileRepository'
import { parseUserProfile, type UserProfile } from '../../modules/auth/domain/UserProfile'

export class FirebaseUserProfileRepository implements UserProfileRepository {
  constructor(private firestore: Firestore) {}

  async getByUid(uid: string): Promise<UserProfile | undefined> {
    const snapshot = await getDoc(doc(this.firestore, 'users', uid))
    return snapshot.exists() ? parseUserProfile(snapshot.data(), uid) : undefined
  }
}
