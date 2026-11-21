import { randomUUID } from 'node:crypto'
import { FieldPath, Timestamp, type Firestore, type Query } from 'firebase-admin/firestore'
import { CreatePendingOrder } from '../../src/modules/orders/application/CreatePendingOrder'
import { ConfirmOrder } from '../../src/modules/orders/application/ConfirmOrder'
import { CancelPendingOrder } from '../../src/modules/orders/application/CancelPendingOrder'
import { ReverseConfirmedOrder } from '../../src/modules/orders/application/ReverseConfirmedOrder'
import { AdjustStock } from '../../src/modules/inventory/application/AdjustStock'
import { checkoutCustomer, normalizedPhone, customerText, type OrderReceipt } from '../../src/modules/orders/application/Checkout'
import { consolidate } from '../../src/modules/orders/domain/Order'
import { normalizeSlug } from '../../src/modules/stores/domain/Store'
import { requireRule } from '../../src/shared/domain/DomainError'
import { publicProduct } from '../../src/infrastructure/firebase/catalog/publicProjection'
import { AdminCommerceUnitOfWork } from './AdminCommerceUnitOfWork'
import { id, movementDto, orderDto, productDto, record, text } from './dto'
import { keyId } from './repositories'

function keys(value: unknown, allowed: string[]) {
  const d = record(value)
  requireRule(Object.keys(d).every(key => allowed.includes(key)), 'INVALID_INPUT')
  return d
}
function requestKey(value: unknown) {
  const key = text(value, 36)
  requireRule(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key), 'INVALID_INPUT')
  return key
}
export async function executeCommand(db: Firestore, command: string, input: unknown, uid?: string,
  fault?: (stage: 'products' | 'movements' | 'orders') => void): Promise<unknown> {
  const runtime = { now: () => new Date().toISOString(), nextId: () => randomUUID() }
  if (command === 'createPendingOrder') {
    const d = keys(input, ['slug', 'items', 'customer', 'idempotencyKey'])
    const slug = normalizeSlug(text(d.slug, 63))
    const c = keys(d.customer, ['name', 'phone', 'note'])
    const customer = checkoutCustomer({ name: text(c.name), phone: text(c.phone, 32), ...(c.note === undefined ? {} : { note: typeof c.note === 'string' ? c.note : text(c.note, 500) }) })
    requireRule(Array.isArray(d.items) && d.items.length <= 50, 'INVALID_INPUT')
    const items = consolidate(d.items.map(value => { const item = keys(value, ['productId', 'quantity']); return { productId: id(item.productId), quantity: item.quantity as number } }))
    const idempotencyKey = requestKey(d.idempotencyKey)
    return db.runTransaction(async transaction => {
      const mapping = await transaction.get(db.doc(`publicStoreSlugs/${slug}`))
      requireRule(mapping.exists, 'STORE_NOT_FOUND')
      const storeId = id(mapping.data()?.storeId)
      const store = (await transaction.get(db.doc(`stores/${storeId}`))).data()
      requireRule(store && store.id === storeId && store.slug === slug && store.publicCatalogEnabled === true, 'STORE_NOT_FOUND')
      requireRule(store.status === 'ACTIVE', 'STORE_SUSPENDED')
      const whatsapp = normalizedPhone(store.whatsapp ?? '')
      const previous = await transaction.get(db.doc(`stores/${storeId}/orderRequests/${keyId(idempotencyKey)}`))
      if (!previous.exists) {
        for (const item of items) {
          const raw = (await transaction.get(db.doc(`stores/${storeId}/products/${item.productId}`))).data()
          requireRule(raw, 'PRODUCT_NOT_FOUND')
          const product = productDto(raw, storeId, item.productId)
          requireRule(product.status === 'ACTIVE' && product.stock > 0, 'PRODUCT_UNAVAILABLE')
          const category = (await transaction.get(db.doc(`stores/${storeId}/categories/${product.categoryId}`))).data()
          requireRule(category?.storeId === storeId && category.status === 'ACTIVE', 'PRODUCT_UNAVAILABLE')
          // Public limits are conservative availability bands, never a stock reservation.
          const maximum = publicProduct(product).maxQuantity
          requireRule(item.quantity <= maximum, 'INVALID_QUANTITY')
        }
      }
      const order = await new CreatePendingOrder(new AdminCommerceUnitOfWork(db, transaction, storeId, store, fault), runtime)
        .execute({ storeId, items, customer, idempotencyKey })
      const receipt: OrderReceipt = { id: order.id, storeId, storeName: text(store.name), whatsapp,
        items: order.items, totalCents: order.totalCents, customer: order.customer, createdAt: order.createdAt }
      return receipt
    })
  }
  requireRule(uid, 'ACCESS_DENIED')
  return db.runTransaction(async transaction => {
    const profile = (await transaction.get(db.doc(`users/${id(uid)}`))).data()
    requireRule(profile?.uid === uid && profile.status === 'ACTIVE' && profile.role === 'MERCHANT', 'ACCESS_DENIED')
    const storeId = id(profile.storeId)
    const store = (await transaction.get(db.doc(`stores/${storeId}`))).data()
    requireRule(store?.id === storeId, 'STORE_NOT_FOUND')
    const actor = { actorId: uid, role: 'MERCHANT' as const, storeId }
    if (command === 'listOrders' || command === 'listMovements') {
      const d = keys(input, ['status', 'cursor'])
      let query: Query = db.collection(`stores/${storeId}/${command === 'listOrders' ? 'orders' : 'stockMovements'}`)
      if (d.status !== undefined) {
        requireRule(command === 'listOrders' && ['PENDING', 'CONFIRMED', 'CANCELLED', 'REVERSED'].includes(String(d.status)), 'INVALID_INPUT')
        query = query.where('status', '==', d.status)
      }
      query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc')
      if (d.cursor !== undefined) {
        const cursor = keys(d.cursor, ['seconds', 'nanoseconds', 'id'])
        requireRule(Number.isSafeInteger(cursor.seconds) && Number.isSafeInteger(cursor.nanoseconds), 'INVALID_INPUT')
        query = query.startAfter(new Timestamp(cursor.seconds as number, cursor.nanoseconds as number), id(cursor.id))
      }
      const rows = await transaction.get(query.limit(25))
      const last = rows.docs.at(-1)
      const stamp = last?.data().createdAt
      return { items: rows.docs.map(doc => command === 'listOrders' ? orderDto(doc.data(), storeId, doc.id) : movementDto(doc.data(), storeId)),
        cursor: rows.size === 25 && stamp instanceof Timestamp ? { seconds: stamp.seconds, nanoseconds: stamp.nanoseconds, id: last!.id } : null }
    }
    if (command === 'getOrder') {
      const d = keys(input, ['orderId']); const orderId = id(d.orderId)
      const order = (await transaction.get(db.doc(`stores/${storeId}/orders/${orderId}`))).data()
      requireRule(order, 'ORDER_NOT_FOUND')
      return orderDto(order, storeId, orderId)
    }
    requireRule(store.status === 'ACTIVE', 'STORE_SUSPENDED')
    const uow = new AdminCommerceUnitOfWork(db, transaction, storeId, store, fault)
    if (command === 'adjustStock') {
      const d = keys(input, ['productId', 'type', 'quantity', 'reason', 'idempotencyKey'])
      requireRule(d.type === 'MANUAL_ENTRY' || d.type === 'MANUAL_EXIT', 'INVALID_INPUT')
      return new AdjustStock(uow, runtime).execute(actor, { storeId, productId: id(d.productId), type: d.type,
        quantity: d.quantity as number, reason: customerText(text(d.reason, 500), 500), idempotencyKey: requestKey(d.idempotencyKey) })
    }
    const d = keys(input, ['orderId']); const orderId = id(d.orderId)
    if (command === 'confirmOrder') return new ConfirmOrder(uow, runtime).execute(actor, storeId, orderId)
    if (command === 'cancelPendingOrder') return new CancelPendingOrder(uow, runtime).execute(actor, storeId, orderId)
    if (command === 'reverseConfirmedOrder') return new ReverseConfirmedOrder(uow, runtime).execute(actor, storeId, orderId)
    requireRule(false, 'INVALID_INPUT')
  })
}
