import type { SessionState } from '../../modules/auth/application/AuthService'

export function routeDestination(session: SessionState, path: string): string | undefined {
  if (session.status === 'UNAUTHENTICATED') return path === '/login' ? undefined : '/login'
  if (session.status === 'ACCESS_DENIED') return path === '/acesso-negado' ? undefined : '/acesso-negado'
  if (session.status !== 'AUTHENTICATED') return undefined
  if (session.actor.role === 'MASTER') return path === '/master' ? undefined : '/master'
  return !path.startsWith('/painel') ? '/painel' : undefined
}
