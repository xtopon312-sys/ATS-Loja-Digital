export type ErrorCode =
  | 'PRODUCT_LIMIT_REACHED' | 'CATEGORY_LIMIT_REACHED' | 'PRODUCT_NOT_FOUND'
  | 'CATEGORY_NOT_FOUND' | 'CATEGORY_IN_USE' | 'INVALID_PRICE' | 'INVALID_STOCK'
  | 'INVALID_QUANTITY' | 'INSUFFICIENT_STOCK' | 'ORDER_NOT_FOUND' | 'INVALID_ORDER_STATE'
  | 'CROSS_STORE_ACCESS' | 'STORE_SUSPENDED' | 'STORE_NOT_FOUND' | 'IDEMPOTENCY_CONFLICT'
  | 'ACCESS_DENIED' | 'INVALID_INPUT' | 'INVALID_SLUG' | 'SLUG_IN_USE'
  | 'PLAN_NOT_FOUND' | 'PRODUCT_UNAVAILABLE' | 'DUPLICATE_ID' | 'TRANSACTION_CLOSED'
  | 'INVALID_STOCK_HISTORY'

export class DomainError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code)
    this.name = 'DomainError'
  }
}

export function requireRule(condition: unknown, code: ErrorCode): asserts condition {
  if (!condition) throw new DomainError(code)
}

export function integer(value: number, minimum: number, code: ErrorCode): number {
  requireRule(Number.isSafeInteger(value) && value >= minimum, code)
  return value
}

export function nonempty(value: string): string {
  requireRule(typeof value === 'string' && value.trim().length > 0, 'INVALID_INPUT')
  return value.trim()
}
