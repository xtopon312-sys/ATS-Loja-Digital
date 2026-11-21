import type { Order } from '../domain/Order'
export interface OrderRepository {
  get(storeId: string, id: string): Promise<Order | undefined>
  findByIdempotencyKey(storeId: string, key: string): Promise<Order | undefined>
  insert(order: Order): Promise<void>
  update(storeId: string, order: Order): Promise<void>
}
