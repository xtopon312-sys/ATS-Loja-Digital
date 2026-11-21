import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckoutForm } from './CheckoutForm'
import type { CheckoutGateway, OrderReceipt } from '../../modules/orders/application/Checkout'
const store = { storeId: 'store-demo', slug: 'store-demo', name: 'Store DEMO', themePreset: 'clean' as const, publishable: true as const, whatsapp: '15555550101' }
const receipt: OrderReceipt = { id: 'order-demo', storeId: store.storeId, storeName: store.name, whatsapp: store.whatsapp,
  items: [{ productId: 'p1', name: 'Produto DEMO', quantity: 1, unitPriceCents: 1990, subtotalCents: 1990 }], totalCents: 1990,
  customer: { name: 'Cliente DEMO', phone: '15555550102' }, createdAt: '2026-09-05T12:00:00.000Z' }
const fill = () => {
  fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Cliente DEMO' } })
  fireEvent.change(screen.getByLabelText('Seu telefone com DDI e DDD'), { target: { value: '15555550102' } })
}
beforeEach(() => { sessionStorage.clear() })
afterEach(cleanup)
describe('public checkout UI', () => {
  it('blocks checkout when Store WhatsApp is absent', () => {
    const createPendingOrder = vi.fn()
    render(<CheckoutForm store={{ ...store, whatsapp: undefined }} items={[{ productId: 'p1', quantity: 1 }]} gateway={{ createPendingOrder }} onCreated={vi.fn()} />)
    expect(screen.getByText(/ainda não configurou/)).toBeVisible(); expect(createPendingOrder).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Criar pedido' })).not.toBeInTheDocument()
  })
  it('keeps cart on failure and retries the same request key', async () => {
    const createPendingOrder = vi.fn<CheckoutGateway['createPendingOrder']>().mockRejectedValueOnce({ code: 'SERVICE_UNAVAILABLE' }).mockResolvedValue(receipt), onCreated = vi.fn()
    render(<CheckoutForm store={store} items={[{ productId: 'p1', quantity: 1 }]} gateway={{ createPendingOrder }} onCreated={onCreated} />)
    fill(); fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' }))
    await screen.findByRole('alert'); expect(onCreated).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByRole('link', { name: 'Enviar pedido pelo WhatsApp' })
    expect(onCreated).toHaveBeenCalledTimes(1); expect(createPendingOrder.mock.calls[0][0]).toEqual(createPendingOrder.mock.calls[1][0])
  })
  it('disables submission while pending and presents an explicit WhatsApp link after success', async () => {
    let resolve!: (value: OrderReceipt) => void
    const createPendingOrder = vi.fn(() => new Promise<OrderReceipt>(r => { resolve = r }))
    render(<CheckoutForm store={store} items={[{ productId: 'p1', quantity: 1 }]} gateway={{ createPendingOrder }} onCreated={vi.fn()} />)
    fill(); fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' }))
    await waitFor(() => expect(createPendingOrder).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button')).toBeDisabled(); expect(screen.queryByRole('link')).not.toBeInTheDocument()
    resolve(receipt); expect(await screen.findByRole('link')).toHaveAttribute('href', expect.stringContaining('https://wa.me/15555550101?text='))
  })
  it('reload restores receipt without creating another order', async () => {
    const createPendingOrder = vi.fn().mockResolvedValue(receipt)
    const props = { store, items: [{ productId: 'p1', quantity: 1 }], gateway: { createPendingOrder }, onCreated: vi.fn() }
    const view = render(<CheckoutForm {...props} />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' })); await screen.findByRole('link'); view.unmount()
    render(<CheckoutForm {...props} items={[]} />); expect(screen.getByText('order-demo')).toBeVisible(); expect(createPendingOrder).toHaveBeenCalledTimes(1)
  })
  it('rejects malformed customer before invoking gateway', async () => {
    const createPendingOrder = vi.fn()
    render(<CheckoutForm store={store} items={[{ productId: 'p1', quantity: 1 }]} gateway={{ createPendingOrder }} onCreated={vi.fn()} />)
    fill(); fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: '<script>' } }); fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' }))
    await screen.findByRole('alert'); expect(createPendingOrder).not.toHaveBeenCalled()
  })
  it('permits revision only after explicit rejection, never an uncertain response', async () => {
    const createPendingOrder = vi.fn().mockRejectedValueOnce({ code: 'SERVICE_UNAVAILABLE' }).mockRejectedValueOnce({ code: 'PRODUCT_UNAVAILABLE' })
    render(<CheckoutForm store={store} items={[{ productId: 'p1', quantity: 1 }]} gateway={{ createPendingOrder }} onCreated={vi.fn()} />)
    fill(); fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' })); await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Revisar dados e sacola' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar dados e sacola' }))
    expect(screen.getByLabelText('Seu nome')).toBeEnabled(); expect(sessionStorage.getItem('ats:checkout:v1:store-demo')).toBeNull()
  })
})
