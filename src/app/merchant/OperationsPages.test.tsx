import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrdersPage, OrderDetail, InventoryPage } from './OperationsPages'
import type { CatalogView } from '../../modules/merchant/application/MerchantApplication'
import type { OperationsGateway } from '../../modules/merchant/application/OperationsGateway'
import type { Order } from '../../modules/orders/domain/Order'
const order: Order = { id: 'order-demo', storeId: 'store-demo', status: 'PENDING', items: [{ productId: 'p1', name: 'Snapshot DEMO', unitPriceCents: 1990, quantity: 1, subtotalCents: 1990 }], totalCents: 1990,
  customer: { name: 'Cliente DEMO', phone: '15555550102' }, createdAt: '2026-09-05T12:00:00.000Z', confirmedAt: null, cancelledAt: null, reversedAt: null,
  confirmedBy: null, cancelledBy: null, reversedBy: null, idempotencyKey: 'demo', requestFingerprint: 'demo' }
function gateway(overrides: Partial<OperationsGateway> = {}): OperationsGateway {
  return { listOrders: vi.fn().mockResolvedValue({ items: [order], cursor: null }), getOrder: vi.fn().mockResolvedValue(order),
    listMovements: vi.fn().mockResolvedValue({ items: [], cursor: null }), confirmOrder: vi.fn().mockResolvedValue({ ...order, status: 'CONFIRMED' }),
    cancelPendingOrder: vi.fn().mockResolvedValue({ ...order, status: 'CANCELLED' }), reverseConfirmedOrder: vi.fn(), adjustStock: vi.fn(), ...overrides }
}
afterEach(cleanup)
const view: CatalogView = { store: { id: 'store-demo', slug: 'store-demo', name: 'Store DEMO', status: 'ACTIVE', planId: 'ats-loja-digital', billingStatus: 'PENDING', createdAt: order.createdAt, updatedAt: order.createdAt },
  products: [{ id: 'p1', storeId: 'store-demo', name: 'Produto DEMO', description: '', categoryId: 'c1', priceCents: 1990, stock: 3, status: 'ACTIVE', createdAt: order.createdAt, updatedAt: order.createdAt }],
  categories: [], limits: { maxProducts: 50, maxCategories: 5 }, summary: { productsUsed: 1, categoriesUsed: 0, activeProducts: 1, inactiveProducts: 0 }, canCreateProduct: true, canCreateCategory: true }
const fillAdjustment = () => {
  fireEvent.change(screen.getByLabelText('Produto para ajuste'), { target: { value: 'p1' } })
  fireEvent.change(screen.getByLabelText('Quantidade do ajuste'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Motivo do ajuste'), { target: { value: 'Contagem DEMO' } })
}
describe('merchant order UI', () => {
  it('loads real gateway data and status filtering', async () => {
    const port = gateway(); render(<OrdersPage gateway={port} />)
    expect(screen.getByText('Carregando pedidos')).toBeVisible(); expect(await screen.findByText('Cliente DEMO')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Status do pedido'), { target: { value: 'CONFIRMED' } }); await screen.findByText('Cliente DEMO')
    expect(port.listOrders).toHaveBeenLastCalledWith('CONFIRMED', undefined)
  })
  it('shows empty and failed loading states', async () => {
    const view = render(<OrdersPage gateway={gateway({ listOrders: vi.fn().mockResolvedValue({ items: [], cursor: null }) })} />)
    expect(await screen.findByText('Nenhum pedido encontrado')).toBeVisible(); view.unmount()
    render(<OrdersPage gateway={gateway({ listOrders: vi.fn().mockRejectedValue({ code: 'ACCESS_DENIED' }) })} />)
    expect(await screen.findByText('Não foi possível carregar pedidos')).toBeVisible()
  })
  it('requires confirmation dialog and preserves snapshot', async () => {
    const port = gateway(); render(<OrderDetail gateway={port} orderId={order.id} canWrite reload={vi.fn()} />)
    expect(await screen.findByText('Snapshot DEMO')).toBeVisible(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    const dialog = screen.getByRole('alertdialog'); expect(port.confirmOrder).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByText('Confirmado')).toBeVisible(); expect(port.confirmOrder).toHaveBeenCalledWith(order.id)
  })
  it('keeps confirmation failure visible and pending', async () => {
    render(<OrderDetail gateway={gateway({ confirmOrder: vi.fn().mockRejectedValue({ code: 'INSUFFICIENT_STOCK' }) })} orderId={order.id} canWrite reload={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar pedido' })); fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmar pedido' }))
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('Estoque insuficiente'); expect(screen.getByText('Pendente')).toBeVisible()
  })
  it('suspended store cannot trigger commercial actions', async () => {
    render(<OrderDetail gateway={gateway()} orderId={order.id} canWrite={false} reload={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Confirmar pedido' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeDisabled()
  })
  it('inventory shows current stock, empty history and records a manual entry through the gateway', async () => {
    const port = gateway({ adjustStock: vi.fn().mockResolvedValue({ id: 'movement' }) }), reload = vi.fn()
    render(<InventoryPage gateway={port} view={view} reload={reload} />)
    expect(await screen.findByText('Nenhum movimento registrado')).toBeVisible()
    fillAdjustment(); fireEvent.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByText('Estoque ajustado e movimento registrado.')).toBeVisible()
    expect(port.adjustStock).toHaveBeenCalledWith(expect.objectContaining({ productId: 'p1', type: 'MANUAL_ENTRY', quantity: 2, reason: 'Contagem DEMO' })); expect(reload).toHaveBeenCalledTimes(1)
  })
  it('insufficient manual exit presents an error and allows corrected data', async () => {
    render(<InventoryPage gateway={gateway({ adjustStock: vi.fn().mockRejectedValue({ code: 'INSUFFICIENT_STOCK' }) })} view={view} reload={vi.fn()} />)
    fillAdjustment(); fireEvent.change(screen.getByLabelText('Tipo de ajuste'), { target: { value: 'MANUAL_EXIT' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Estoque insuficiente')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar dados' })); expect(screen.getByLabelText('Quantidade do ajuste')).toBeEnabled()
  })
  it('uncertain manual response retries with the same key and does not permit a new attempt', async () => {
    const port = gateway({ adjustStock: vi.fn().mockRejectedValue({ code: 'SERVICE_UNAVAILABLE' }) })
    render(<InventoryPage gateway={port} view={view} reload={vi.fn()} />); fillAdjustment(); fireEvent.click(screen.getByRole('button', { name: 'Registrar ajuste' })); await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Revisar dados' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar ajuste' })); await screen.findByRole('alert')
    const calls = vi.mocked(port.adjustStock).mock.calls; expect(calls[0][0]).toEqual(calls[1][0])
  })
})
