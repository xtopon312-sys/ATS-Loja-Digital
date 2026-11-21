import { useEffect, useRef, useState, type FormEvent } from 'react'
import { commandWasRejected } from '../../modules/orders/application/Checkout'
import type { OperationsGateway, HistoryPage, PageCursor } from '../../modules/merchant/application/OperationsGateway'
import type { Order } from '../../modules/orders/domain/Order'
import type { StockMovement } from '../../modules/inventory/domain/StockMovement'
import type { CatalogView } from '../../modules/merchant/application/MerchantApplication'
import { feedback } from '../../modules/merchant/application/feedback'
import { formatBRL } from '../../modules/merchant/application/money'
import { Button } from '../../shared/ui/Button'
import { Input, Select, Textarea } from '../../shared/ui/FormControls'
import { Card } from '../../shared/ui/Card'
import { Table } from '../../shared/ui/Table'
import { DomainStatusBadge, StateBox } from '../../shared/ui/Semantic'
import { AlertDialog } from '../../shared/ui/AlertDialog'
import { navigate } from './navigation'

const labels = { PENDING: 'Pendente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', REVERSED: 'Estornado' }
const movementLabels = { MANUAL_ENTRY: 'Entrada manual', MANUAL_EXIT: 'Saída manual', ORDER_CONFIRMED: 'Pedido confirmado', ORDER_REVERSED: 'Pedido estornado' }
const when = (value: string) => new Date(value).toLocaleString('pt-BR')
export function OrdersPage({ gateway }: { gateway: OperationsGateway }) {
  const [status, setStatus] = useState<Order['status'] | ''>(''), [cursor, setCursor] = useState<PageCursor>()
  const [page, setPage] = useState<HistoryPage<Order>>(), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => { let live = true
    void gateway.listOrders(status || undefined, cursor).then(result => { if (live) setPage(result) }, cause => { if (live) setError(feedback(cause)) })
    return () => { live = false }
  }, [gateway, status, cursor, attempt])
  return <><Select label="Status do pedido" value={status} onChange={e => { setStatus(e.target.value as Order['status'] | ''); setCursor(undefined); setPage(undefined); setError('') }}><option value="">Todos</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
    {error ? <><StateBox kind="error" title="Não foi possível carregar pedidos" description={error} /><Button onClick={() => { setError(''); setAttempt(v => v + 1) }}>Tentar novamente</Button></> : !page ? <StateBox kind="loading" title="Carregando pedidos" description="Consultando até 25 pedidos por página." /> : !page.items.length ? <StateBox kind="empty" title="Nenhum pedido encontrado" description="Os pedidos enviados pela loja pública aparecerão aqui." /> : <Card className="catalog-table"><Table><caption className="sr-only">Pedidos da loja</caption><thead><tr><th>Código / data</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th><th>Ação</th></tr></thead><tbody>{page.items.map(order => <tr key={order.id}><td><span className="order-code">{order.id}</span><small>{when(order.createdAt)}</small></td><td>{order.customer.name}<small>{order.customer.phone}</small></td><td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td>{formatBRL(order.totalCents)}</td><td><DomainStatusBadge status={order.status} label={labels[order.status]} /></td><td><Button variant="secondary" onClick={() => navigate(`/painel/pedidos/${order.id}`)}>Ver pedido</Button></td></tr>)}</tbody></Table></Card>}
    <div className="row-actions">{cursor && <Button variant="secondary" onClick={() => { setCursor(undefined); setPage(undefined); setError('') }}>Primeira página</Button>}{page?.cursor && <Button onClick={() => { setCursor(page.cursor!); setPage(undefined); setError('') }}>Próxima página</Button>}</div></>
}
export function OrderDetail({ gateway, orderId, canWrite, reload }: { gateway: OperationsGateway; orderId: string; canWrite: boolean; reload(): void }) {
  const [order, setOrder] = useState<Order>(), [error, setError] = useState(''), [notice, setNotice] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => { let live = true
    void gateway.getOrder(orderId).then(result => { if (live) setOrder(result) }, cause => { if (live) setError(feedback(cause)) })
    return () => { live = false }
  }, [gateway, orderId, attempt])
  async function act(operation: () => Promise<Order>) {
    setError(''); setNotice('')
    try { setOrder(await operation()); setNotice('Pedido atualizado.'); reload(); return true }
    catch (cause) { setError(feedback(cause)); return false }
  }
  if (!order) return <>{error ? <><StateBox kind="error" title="Pedido indisponível" description={error} /><Button onClick={() => { setError(''); setAttempt(v => v + 1) }}>Tentar novamente</Button></> : <StateBox kind="loading" title="Carregando pedido" description="Buscando os dados preservados no pedido." />}</>
  return <div className="order-detail"><Button variant="ghost" onClick={() => navigate('/painel/pedidos')}>Voltar aos pedidos</Button><Card><h2>Pedido <span className="order-code">{order.id}</span></h2><DomainStatusBadge status={order.status} label={labels[order.status]} /><p>{order.customer.name} · {order.customer.phone}</p>{order.customer.note && <p>Observação: {order.customer.note}</p>}<p>Criado em {when(order.createdAt)}</p>{order.confirmedAt && <p>Confirmado em {when(order.confirmedAt)} por {order.confirmedBy}</p>}{order.cancelledAt && <p>Cancelado em {when(order.cancelledAt)} por {order.cancelledBy}</p>}{order.reversedAt && <p>Estornado em {when(order.reversedAt)} por {order.reversedBy}</p>}</Card><Card className="catalog-table"><Table><caption>Itens preservados no pedido</caption><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th><th>Subtotal</th></tr></thead><tbody>{order.items.map(item => <tr key={item.productId}><td>{item.name}</td><td>{item.quantity}</td><td>{formatBRL(item.unitPriceCents)}</td><td>{formatBRL(item.subtotalCents)}</td></tr>)}</tbody></Table><p>Total: <strong>{formatBRL(order.totalCents)}</strong></p></Card>{notice && <p role="status">{notice}</p>}{error && <p role="alert" className="form-error">{error}</p>}<div className="row-actions">
    {order.status === 'PENDING' && <><AlertDialog trigger={<Button disabled={!canWrite}>Confirmar pedido</Button>} title="Confirmar pedido?" description="A confirmação baixa o estoque de todos os itens. Se faltar algum produto, nada será alterado." confirmLabel="Confirmar pedido" errorMessage={error} onConfirm={() => act(() => gateway.confirmOrder(order.id))} /><AlertDialog trigger={<Button variant="secondary" disabled={!canWrite}>Cancelar pedido</Button>} title="Cancelar pedido pendente?" description="O pedido será cancelado. O estoque não será alterado." confirmLabel="Cancelar pedido" errorMessage={error} onConfirm={() => act(() => gateway.cancelPendingOrder(order.id))} /></>}
    {order.status === 'CONFIRMED' && <AlertDialog trigger={<Button variant="secondary" disabled={!canWrite}>Estornar pedido</Button>} title="Estornar integralmente?" description="Todas as quantidades baixadas por este pedido serão devolvidas ao estoque. Não há estorno parcial." confirmLabel="Estornar pedido" errorMessage={error} onConfirm={() => act(() => gateway.reverseConfirmedOrder(order.id))} />}</div></div>
}
export function InventoryPage({ gateway, view, reload }: { gateway: OperationsGateway; view: CatalogView; reload(): void }) {
  const [page, setPage] = useState<HistoryPage<StockMovement>>(), [cursor, setCursor] = useState<PageCursor>(), [attempt, setAttempt] = useState(0)
  const [loadError, setLoadError] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const [request, setRequest] = useState<Parameters<OperationsGateway['adjustStock']>[0]>()
  const inFlight = useRef(false)
  const [canRevise, setCanRevise] = useState(false)
  useEffect(() => { let live = true
    void gateway.listMovements(cursor).then(result => { if (live) setPage(result) }, cause => { if (live) setLoadError(feedback(cause)) })
    return () => { live = false }
  }, [gateway, cursor, attempt])
  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(''); setNotice(''); setCanRevise(false)
    const form = event.currentTarget, fields = new FormData(form)
    try {
      const input = request ?? { productId: String(fields.get('productId')), type: String(fields.get('type')) as 'MANUAL_ENTRY' | 'MANUAL_EXIT',
        quantity: Number(fields.get('quantity')), reason: String(fields.get('reason')), idempotencyKey: crypto.randomUUID() }
      setRequest(input)
      await gateway.adjustStock(input); setRequest(undefined); form.reset(); setNotice('Estoque ajustado e movimento registrado.'); reload(); setCursor(undefined); setPage(undefined); setAttempt(v => v + 1)
    } catch (cause) { setError(feedback(cause)); setCanRevise(commandWasRejected(cause)) } finally { inFlight.current = false; setBusy(false) }
  }
  return <div className="order-detail"><Card className="catalog-table"><h2>Estoque atual</h2>{!view.products.length ? <StateBox kind="empty" title="Nenhum produto cadastrado" description="Cadastre um produto para começar." /> : <Table><thead><tr><th>Produto</th><th>Status</th><th>Unidades</th></tr></thead><tbody>{view.products.map(p => <tr key={p.id}><td>{p.name}</td><td><DomainStatusBadge status={p.status} label={{ ACTIVE: 'Ativo', INACTIVE: 'Inativo', ARCHIVED: 'Arquivado' }[p.status]} /></td><td>{p.stock}</td></tr>)}</tbody></Table>}</Card>
    <Card><h2>Ajuste manual</h2><form className="merchant-fields" onSubmit={event => { void adjust(event) }} aria-busy={busy}><Select label="Produto para ajuste" name="productId" required disabled={busy || !!request}><option value="">Selecione</option>{view.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><Select label="Tipo de ajuste" name="type" disabled={busy || !!request}><option value="MANUAL_ENTRY">Entrada manual</option><option value="MANUAL_EXIT">Saída manual</option></Select><Input label="Quantidade do ajuste" name="quantity" type="number" required min={1} step={1} disabled={busy || !!request} /><Textarea label="Motivo do ajuste" name="reason" required maxLength={500} disabled={busy || !!request} />{error && <p className="form-error" role="alert">{error}</p>}{request && !busy && <p role="status">Reenviar mantém a mesma chave e evita duplicar o ajuste.</p>}<div className="row-actions"><Button type="submit" loading={busy} disabled={view.store.status !== 'ACTIVE' || !view.products.length}>{request ? 'Reenviar ajuste' : 'Registrar ajuste'}</Button>{request && !busy && canRevise && <Button variant="secondary" onClick={() => { setRequest(undefined); setError('') }}>Revisar dados</Button>}</div></form>{notice && <p role="status">{notice}</p>}</Card>
    <Card className="catalog-table"><h2>Movimentos recentes</h2>{loadError ? <><StateBox kind="error" title="Histórico indisponível" description={loadError} /><Button onClick={() => { setLoadError(''); setAttempt(v => v + 1) }}>Tentar novamente</Button></> : !page ? <StateBox kind="loading" title="Carregando movimentos" description="Até 25 registros por página." /> : !page.items.length ? <StateBox kind="empty" title="Nenhum movimento registrado" description="Ajustes e confirmações de pedidos aparecerão aqui." /> : <Table><thead><tr><th>Data / produto</th><th>Tipo</th><th>Quantidade</th><th>Antes → depois</th><th>Motivo / ator</th></tr></thead><tbody>{page.items.map(m => <tr key={m.id}><td>{when(m.createdAt)}<small>{view.products.find(p => p.id === m.productId)?.name ?? m.productId}</small></td><td>{movementLabels[m.type]}{m.orderId && <small className="order-code">Pedido {m.orderId}</small>}</td><td>{m.quantity}</td><td>{m.previousStock} → {m.newStock}</td><td>{m.reason}<small>{m.createdBy}</small></td></tr>)}</tbody></Table>}<div className="row-actions">{cursor && <Button variant="secondary" onClick={() => { setCursor(undefined); setPage(undefined) }}>Primeira página</Button>}{page?.cursor && <Button onClick={() => { setCursor(page.cursor!); setPage(undefined) }}>Próxima página</Button>}</div></Card></div>
}
