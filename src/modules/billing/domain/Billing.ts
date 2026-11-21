import { integer, requireRule } from '../../../shared/domain/DomainError'

export type BillingStatus = 'PENDING' | 'PAID' | 'OVERDUE'

/** Administrative data only. No payment mutation use case in Phase 2. */
export interface Billing {
  id: string
  storeId: string
  referenceMonth: string
  amountCents: number
  status: BillingStatus
  dueAt: string
  paidAt: string | null
}

export function validateBilling(billing: Billing): void {
  integer(billing.amountCents, 0, 'INVALID_PRICE')
  requireRule(/^\d{4}-(0[1-9]|1[0-2])$/.test(billing.referenceMonth), 'INVALID_INPUT')
  requireRule(['PENDING', 'PAID', 'OVERDUE'].includes(billing.status), 'INVALID_INPUT')
  requireRule(Number.isFinite(Date.parse(billing.dueAt)), 'INVALID_INPUT')
  requireRule(billing.status === 'PAID' ? billing.paidAt !== null && Number.isFinite(Date.parse(billing.paidAt)) : billing.paidAt === null, 'INVALID_INPUT')
}
