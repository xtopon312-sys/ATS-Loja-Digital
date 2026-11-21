import type { Auth } from 'firebase/auth'
import type { CheckoutGateway, CheckoutInput, OrderReceipt } from '../../modules/orders/application/Checkout'
import type { Order } from '../../modules/orders/domain/Order'
import type { StockMovement } from '../../modules/inventory/domain/StockMovement'
import type { HistoryPage, OperationsGateway, PageCursor } from '../../modules/merchant/application/OperationsGateway'

/** This adapter is composed only after the existing emulator-only configuration has been validated. */
export class LocalCommerceGateway implements CheckoutGateway, OperationsGateway {
  constructor(private auth?: Auth) {}
  private async call<T>(command: string, input: unknown): Promise<T> {
    const token = await this.auth?.currentUser?.getIdToken()
    const response = await fetch('http://127.0.0.1:5001/demo-ats-loja-digital/us-central1/commerce', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ command, input }), signal: AbortSignal.timeout(30000), cache: 'no-store',
    })
    const body = await response.json() as { result: T; code?: string }
    if (!response.ok) throw Object.assign(new Error('Local command failed'), { code: body.code ?? 'SERVICE_UNAVAILABLE' })
    return structuredClone(body.result)
  }
  createPendingOrder(input: CheckoutInput) { return this.call<OrderReceipt>('createPendingOrder', input) }
  listOrders(status?: Order['status'], cursor?: PageCursor) { return this.call<HistoryPage<Order>>('listOrders', { ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) }) }
  getOrder(orderId: string) { return this.call<Order>('getOrder', { orderId }) }
  listMovements(cursor?: PageCursor) { return this.call<HistoryPage<StockMovement>>('listMovements', cursor ? { cursor } : {}) }
  confirmOrder(orderId: string) { return this.call<Order>('confirmOrder', { orderId }) }
  cancelPendingOrder(orderId: string) { return this.call<Order>('cancelPendingOrder', { orderId }) }
  reverseConfirmedOrder(orderId: string) { return this.call<Order>('reverseConfirmedOrder', { orderId }) }
  adjustStock(input: Parameters<OperationsGateway['adjustStock']>[0]) { return this.call<StockMovement>('adjustStock', input) }
}
