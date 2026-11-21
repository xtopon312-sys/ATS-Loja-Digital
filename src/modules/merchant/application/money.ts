import { integer, requireRule } from '../../../shared/domain/DomainError'

export function parseBRLCents(input: string): number {
  requireRule(input.length <= 32, 'INVALID_PRICE')
  const value = input.trim().replace(/^R\$\s*/, '')
  requireRule(/^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{2})?$/.test(value), 'INVALID_PRICE')
  const [units, cents = '00'] = value.replaceAll('.', '').split(',')
  const amount = BigInt(units) * 100n + BigInt(cents)
  requireRule(amount <= BigInt(Number.MAX_SAFE_INTEGER), 'INVALID_PRICE')
  return integer(Number(amount), 0, 'INVALID_PRICE')
}
export function priceInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}
