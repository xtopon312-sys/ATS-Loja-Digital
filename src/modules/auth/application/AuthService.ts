import type { ActorContext } from '../../../shared/domain/ActorContext'

export type SessionState =
  | { status: 'LOADING' }
  | { status: 'UNAUTHENTICATED' }
  | { status: 'ACCESS_DENIED' }
  | { status: 'AUTHENTICATED'; actor: Exclude<ActorContext, { role: 'PUBLIC' }> }

export interface AuthService {
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  observeSession(observer: (state: SessionState) => void): () => void
}
