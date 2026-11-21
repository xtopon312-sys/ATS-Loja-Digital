import type { StockMovement } from '../domain/StockMovement'
export interface StockMovementRepository {
  list(storeId: string): Promise<StockMovement[]>
  listByOrder(storeId: string, orderId: string): Promise<StockMovement[]>
  findByIdempotencyKey(storeId: string, key: string): Promise<StockMovement | undefined>
  /** Append only; unique (storeId, id) and (storeId, idempotencyKey). */
  append(movement: StockMovement): Promise<void>
}
