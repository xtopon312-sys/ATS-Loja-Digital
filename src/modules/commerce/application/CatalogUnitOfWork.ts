import type { Transaction } from './UnitOfWork'

/** One catalog mutation and its counters/initial movement, atomically. No order adapter. */
export interface CatalogTransaction {
  stores: Pick<Transaction['stores'], 'get'>
  plans: Transaction['plans']
  products: Transaction['products']
  categories: Transaction['categories']
  stockMovements: Pick<Transaction['stockMovements'], 'append'>
}
export interface CatalogUnitOfWork {
  run<T>(work: (tx: CatalogTransaction) => Promise<T>): Promise<T>
}
