import { nonempty, requireRule } from './DomainError'

/** Local domain/test context only. A future trusted boundary must resolve identity and membership. */
export type ActorContext =
  | { actorId: string; role: 'MASTER'; storeId?: never }
  | { actorId: string; role: 'MERCHANT'; storeId: string }
  | { role: 'PUBLIC'; actorId?: never; storeId?: never }

export function authorize(actor: ActorContext, storeId: string): string {
  requireRule(actor.role === 'MASTER' || actor.role === 'MERCHANT', 'ACCESS_DENIED')
  if (actor.role === 'MERCHANT') requireRule(actor.storeId === storeId, 'CROSS_STORE_ACCESS')
  return nonempty(actor.actorId)
}
