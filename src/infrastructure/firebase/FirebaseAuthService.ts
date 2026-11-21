import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type Auth } from 'firebase/auth'
import type { AuthService, SessionState } from '../../modules/auth/application/AuthService'
import type { ResolveActorContext } from '../../modules/auth/application/ResolveActorContext'

export class FirebaseAuthService implements AuthService {
  constructor(private auth: Auth, private actors: ResolveActorContext) {}

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password)
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth)
  }

  observeSession(observer: (state: SessionState) => void): () => void {
    let active = true
    let revision = 0
    observer({ status: 'LOADING' })
    const unsubscribe = onAuthStateChanged(this.auth, user => {
      const currentRevision = ++revision
      if (!user) {
        observer({ status: 'UNAUTHENTICATED' })
        return
      }
      void this.actors.execute(user.uid).then(
        actor => {
          if (active && currentRevision === revision) observer({ status: 'AUTHENTICATED', actor })
        },
        () => {
          if (active && currentRevision === revision) observer({ status: 'ACCESS_DENIED' })
        },
      )
    })
    return () => {
      active = false
      revision++
      unsubscribe()
    }
  }
}
