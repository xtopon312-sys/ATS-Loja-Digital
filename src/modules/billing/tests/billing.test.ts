import { describe, expect, it } from 'vitest'
import { validateBilling, type Billing } from '../domain/Billing'

const billing: Billing = { id: 'billing-test', storeId: 'a', referenceMonth: '2026-09', amountCents: 10000,
  status: 'PENDING', dueAt: '2026-09-10T12:00:00.000Z', paidAt: null }

describe('administrative billing data', () => {
  it.each(['PENDING', 'OVERDUE', 'PAID'] as const)('accepts consistent %s record', status => {
    expect(() => validateBilling({ ...billing, status, paidAt: status === 'PAID' ? billing.dueAt : null })).not.toThrow()
  })
  it.each([-1, 0.5])('rejects invalid amount %s', amountCents => {
    expect(() => validateBilling({ ...billing, amountCents })).toThrow(expect.objectContaining({ code: 'INVALID_PRICE' }))
  })
  it('rejects invalid reference month and inconsistent payment date', () => {
    expect(() => validateBilling({ ...billing, referenceMonth: '2026-13' })).toThrow()
    expect(() => validateBilling({ ...billing, status: 'PAID' })).toThrow()
    expect(() => validateBilling({ ...billing, paidAt: billing.dueAt })).toThrow()
  })
})
