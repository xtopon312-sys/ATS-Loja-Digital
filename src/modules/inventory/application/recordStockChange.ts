import { integer, nonempty, requireRule } from '../../../shared/domain/DomainError'
import type { Runtime, Transaction } from '../../commerce/application/UnitOfWork'
import type { Product } from '../../products/domain/Product'
import type { MovementType, StockMovement } from '../domain/StockMovement'

/** Internal application operation; callers provide the SAME transaction as the order. */
export async function recordStockChange(tx: { products: Transaction['products']; stockMovements: Pick<Transaction['stockMovements'], 'append'> }, runtime: Runtime, product: Product,
  input: { type: MovementType; quantity: number; actorId: string; reason: string; idempotencyKey: string; orderId?: string },
): Promise<StockMovement> {
  integer(input.quantity, 1, 'INVALID_QUANTITY')
  integer(product.stock, 0, 'INVALID_STOCK')
  const entering = input.type === 'MANUAL_ENTRY' || input.type === 'ORDER_REVERSED'
  const newStock = product.stock + (entering ? input.quantity : -input.quantity)
  requireRule(newStock >= 0, 'INSUFFICIENT_STOCK')
  integer(newStock, 0, 'INVALID_STOCK')
  const now = runtime.now()
  const movement: StockMovement = {
    id: runtime.nextId(), storeId: product.storeId, productId: product.id,
    type: input.type, quantity: input.quantity, previousStock: product.stock, newStock,
    reason: nonempty(input.reason), createdAt: now, createdBy: nonempty(input.actorId),
    idempotencyKey: nonempty(input.idempotencyKey),
    ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
  }
  await tx.products.update(product.storeId, { ...product, stock: newStock, updatedAt: now })
  await tx.stockMovements.append(movement)
  return movement
}
