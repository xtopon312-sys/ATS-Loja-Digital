import { requireRule } from '../../../shared/domain/DomainError'
import type { BillingStatus } from '../../billing/domain/Billing'

export interface Store {
  id: string
  whatsapp?: string
  slug: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED'
  planId: string
  billingStatus: BillingStatus
  createdAt: string
  updatedAt: string
}

export function normalizeSlug(value: string): string {
  const slug = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '-')
  requireRule(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 63, 'INVALID_SLUG')
  return slug
}
