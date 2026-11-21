import { nonempty, requireRule } from '../../../shared/domain/DomainError'

export type UserRole = 'MASTER' | 'MERCHANT'
export type UserStatus = 'ACTIVE' | 'DISABLED'

export type UserProfile = {
  uid: string
  name: string
  email: string
  status: UserStatus
  createdAt: string
  updatedAt: string
} & (
  | { role: 'MASTER'; storeId: null }
  | { role: 'MERCHANT'; storeId: string }
)

export function parseUserProfile(value: unknown, expectedUid: string): UserProfile {
  requireRule(typeof value === 'object' && value !== null, 'ACCESS_DENIED')
  const profile = value as Record<string, unknown>
  requireRule(profile.uid === expectedUid, 'ACCESS_DENIED')
  requireRule(profile.status === 'ACTIVE' || profile.status === 'DISABLED', 'ACCESS_DENIED')
  requireRule(profile.role === 'MASTER' || profile.role === 'MERCHANT', 'ACCESS_DENIED')
  requireRule(typeof profile.name === 'string' && typeof profile.email === 'string', 'ACCESS_DENIED')
  requireRule(typeof profile.createdAt === 'string' && typeof profile.updatedAt === 'string', 'ACCESS_DENIED')
  nonempty(profile.name)
  nonempty(profile.email)
  if (profile.role === 'MASTER') {
    requireRule(profile.storeId === null, 'ACCESS_DENIED')
  } else {
    requireRule(typeof profile.storeId === 'string', 'ACCESS_DENIED')
    nonempty(profile.storeId)
  }
  return profile as UserProfile
}
