import { createHash } from 'node:crypto'
import type { Firestore, Transaction as FirestoreTransaction } from 'firebase-admin/firestore'
import type { OrderRepository } from '../../src/modules/orders/application/OrderRepository'
import type { StockMovementRepository } from '../../src/modules/inventory/application/StockMovementRepository'
import type { Order } from '../../src/modules/orders/domain/Order'
import type { StockMovement } from '../../src/modules/inventory/domain/StockMovement'
import { requireRule } from '../../src/shared/domain/DomainError'
import { id, movementDto, orderDto, timestamps } from './dto'

export function keyId(key: string) { return createHash('sha256').update(key).digest('hex') }
export class FirestoreOrderRepository implements OrderRepository {
  readonly pending = new Map<string, Order>()
  private inserted = new Set<string>()
  constructor(private db: Firestore, private tx: FirestoreTransaction, private storeId: string) {}
  private scope(storeId: string) { requireRule(storeId === this.storeId, 'CROSS_STORE_ACCESS') }
  async get(storeId: string, orderId: string) {
    this.scope(storeId)
    const cached = this.pending.get(orderId)
    if (cached) return structuredClone(cached)
    const doc = await this.tx.get(this.db.doc(`stores/${storeId}/orders/${id(orderId)}`))
    return doc.exists ? orderDto(doc.data(), storeId, orderId) : undefined
  }
  async findByIdempotencyKey(storeId: string, key: string) {
    this.scope(storeId)
    const marker = await this.tx.get(this.db.doc(`stores/${storeId}/orderRequests/${keyId(key)}`))
    return marker.exists ? this.get(storeId, id(marker.data()?.orderId)) : undefined
  }
  async insert(order: Order) {
    this.scope(order.storeId)
    requireRule(!await this.get(order.storeId, order.id), 'DUPLICATE_ID')
    requireRule(!await this.findByIdempotencyKey(order.storeId, order.idempotencyKey), 'IDEMPOTENCY_CONFLICT')
    this.pending.set(order.id, orderDto(order, this.storeId, order.id)); this.inserted.add(order.id)
  }
  async update(storeId: string, order: Order) {
    this.scope(storeId)
    const original = await this.get(storeId, order.id)
    requireRule(original, 'ORDER_NOT_FOUND')
    for (const key of ['items', 'customer', 'totalCents', 'createdAt', 'idempotencyKey', 'requestFingerprint'] as const) {
      requireRule(JSON.stringify(original[key]) === JSON.stringify(order[key]), 'INVALID_INPUT')
    }
    this.pending.set(order.id, orderDto(order, storeId, order.id))
  }
  flush() {
    for (const order of this.pending.values()) {
      const ref = this.db.doc(`stores/${this.storeId}/orders/${order.id}`)
      if (this.inserted.has(order.id)) {
        this.tx.create(ref, timestamps(order))
        this.tx.create(this.db.doc(`stores/${this.storeId}/orderRequests/${keyId(order.idempotencyKey)}`), { orderId: order.id })
      } else this.tx.update(ref, timestamps(order))
    }
  }
}
export class FirestoreStockMovementRepository implements StockMovementRepository {
  readonly pending: StockMovement[] = []
  constructor(private db: Firestore, private tx: FirestoreTransaction, private storeId: string) {}
  private scope(storeId: string) { requireRule(storeId === this.storeId, 'CROSS_STORE_ACCESS') }
  async list(_storeId: string): Promise<StockMovement[]> {
    void _storeId
    throw new Error('Use a bounded history page or listByOrder')
  }
  async listByOrder(storeId: string, orderId: string) {
    this.scope(storeId)
    const rows = await this.tx.get(this.db.collection(`stores/${storeId}/stockMovements`).where('orderId', '==', id(orderId)).limit(101))
    requireRule(rows.size <= 100, 'INVALID_STOCK_HISTORY')
    return rows.docs.map(row => movementDto(row.data(), storeId))
  }
  async findByIdempotencyKey(storeId: string, key: string) {
    this.scope(storeId)
    const marker = await this.tx.get(this.db.doc(`stores/${storeId}/movementRequests/${keyId(key)}`))
    if (!marker.exists) return undefined
    const movement = await this.tx.get(this.db.doc(`stores/${storeId}/stockMovements/${id(marker.data()?.movementId)}`))
    requireRule(movement.exists, 'INVALID_STOCK_HISTORY')
    return movementDto(movement.data(), storeId)
  }
  async append(movement: StockMovement) {
    this.scope(movement.storeId)
    requireRule(!this.pending.some(row => row.id === movement.id || row.idempotencyKey === movement.idempotencyKey), 'IDEMPOTENCY_CONFLICT')
    requireRule(!await this.findByIdempotencyKey(this.storeId, movement.idempotencyKey), 'IDEMPOTENCY_CONFLICT')
    this.pending.push(movementDto(movement, this.storeId))
  }
  flush() {
    for (const movement of this.pending) {
      this.tx.create(this.db.doc(`stores/${this.storeId}/stockMovements/${movement.id}`), timestamps(movement))
      this.tx.create(this.db.doc(`stores/${this.storeId}/movementRequests/${keyId(movement.idempotencyKey)}`), { movementId: movement.id })
    }
  }
}
