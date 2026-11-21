export type MovementType = 'MANUAL_ENTRY' | 'MANUAL_EXIT' | 'ORDER_CONFIRMED' | 'ORDER_REVERSED'
export interface StockMovement {
  id: string
  storeId: string
  productId: string
  orderId?: string
  type: MovementType
  quantity: number
  previousStock: number
  newStock: number
  reason: string
  createdAt: string
  createdBy: string
  idempotencyKey: string
}
