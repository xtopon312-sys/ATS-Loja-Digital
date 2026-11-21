import type { Order } from '../../orders/domain/Order'
import type { StockMovement } from '../../inventory/domain/StockMovement'
export interface PageCursor { seconds: number; nanoseconds: number; id: string }
export interface HistoryPage<T> { items: T[]; cursor: PageCursor | null }
export interface OperationsGateway {
  listOrders(status?: Order['status'], cursor?: PageCursor): Promise<HistoryPage<Order>>
  getOrder(orderId: string): Promise<Order>
  listMovements(cursor?: PageCursor): Promise<HistoryPage<StockMovement>>
  confirmOrder(orderId: string): Promise<Order>
  cancelPendingOrder(orderId: string): Promise<Order>
  reverseConfirmedOrder(orderId: string): Promise<Order>
  adjustStock(input: { productId: string; type: 'MANUAL_ENTRY' | 'MANUAL_EXIT'; quantity: number; reason: string; idempotencyKey: string }): Promise<StockMovement>
}
