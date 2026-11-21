import { useRef, useState, type FormEvent } from 'react'
import { checkoutCustomer, commandWasRejected, normalizedPhone, whatsappLink, type CheckoutGateway } from '../../modules/orders/application/Checkout'
import { decodeCheckoutSession, type CheckoutSession } from '../../modules/orders/application/CheckoutSession'
import type { PublicStore } from '../../modules/storefront/domain/PublicCatalog'
import type { CartItem } from '../../modules/storefront/domain/Cart'
import { formatBRL } from '../../modules/merchant/application/money'
import { feedback } from '../../modules/merchant/application/feedback'
import { Input, Textarea } from '../../shared/ui/FormControls'
import { Button } from '../../shared/ui/Button'

export function CheckoutForm({ store, items, gateway, onCreated }: { store: PublicStore; items: CartItem[]; gateway: CheckoutGateway; onCreated(): void }) {
  const key = `ats:checkout:v1:${store.storeId}`
  const [session, setSession] = useState(() => { try { return decodeCheckoutSession(sessionStorage.getItem(key), store.storeId, store.slug) } catch { return undefined } })
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [canRevise, setCanRevise] = useState(false)
  const inFlight = useRef(false)
  let validPhone = true
  try { normalizedPhone(store.whatsapp ?? '') } catch { validPhone = false }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || session?.receipt || !validPhone) return
    inFlight.current = true; setBusy(true); setError(''); setCanRevise(false)
    try {
      const data = new FormData(event.currentTarget)
      const current: CheckoutSession = session ?? { version: 1, storeId: store.storeId, input: { slug: store.slug, items,
        customer: checkoutCustomer({ name: String(data.get('name') ?? ''), phone: String(data.get('phone') ?? ''), note: String(data.get('note') ?? '') }), idempotencyKey: crypto.randomUUID() } }
      // Persist the retry key BEFORE the request. Fail closed if this tab cannot keep the retry evidence.
      sessionStorage.setItem(key, JSON.stringify(current)); setSession(current)
      const receipt = await gateway.createPendingOrder(current.input)
      const complete = { ...current, receipt }
      // Keep the successful result visible even if saving the receipt fails; the stored request can be retried safely.
      setSession(complete); onCreated()
      try { sessionStorage.setItem(key, JSON.stringify(complete)) } catch { setError('Pedido criado. Guarde o código exibido; o navegador não conseguiu salvar o comprovante.') }
    } catch (cause) { setError(feedback(cause)); setCanRevise(commandWasRejected(cause)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  if (session?.receipt) {
    const receipt = session.receipt
    return <section className="checkout-result" aria-label="Pedido criado"><h3>Pedido enviado para análise da loja</h3><p role="status">Pedido pendente. O estoque ainda não foi reservado.</p><p className="order-code">Código: <strong>{receipt.id}</strong></p><ul>{receipt.items.map(item => <li key={item.productId}>{item.quantity} × {item.name} — {formatBRL(item.subtotalCents)}</li>)}</ul><strong>Total: {formatBRL(receipt.totalCents)}</strong><a className="store-action" href={whatsappLink(receipt)} target="_blank" rel="noopener noreferrer">Enviar pedido pelo WhatsApp</a>{error && <p role="alert">{error}</p>}<button className="public-text-button" onClick={() => { try { sessionStorage.removeItem(key); setSession(undefined); setError('') } catch { setError('Não foi possível iniciar outro pedido neste navegador.') } }}>Preparar outro pedido</button></section>
  }
  if (!validPhone) return <p role="status">Esta loja ainda não configurou um WhatsApp válido para receber pedidos.</p>
  if (!items.length && !session) return null
  return <form onSubmit={event => { void submit(event) }} className="merchant-fields public-checkout" aria-label="Dados do pedido" aria-busy={busy}><h3>Seus dados</h3><p>Pedido sujeito à confirmação da loja. Não há pagamento online.</p><Input label="Seu nome" name="name" required maxLength={120} defaultValue={session?.input.customer.name} disabled={busy || !!session} aria-describedby={error ? 'checkout-error' : undefined} /><Input label="Seu telefone com DDI e DDD" name="phone" type="tel" required maxLength={32} defaultValue={session?.input.customer.phone} disabled={busy || !!session} aria-invalid={!!error} aria-describedby={error ? 'checkout-error' : undefined} /><Textarea label="Observação (opcional)" name="note" maxLength={500} defaultValue={session?.input.customer.note} disabled={busy || !!session} aria-invalid={!!error} aria-describedby={error ? 'checkout-error' : undefined} />{session && <p role="status">Tentativa salva nesta aba. Reenviar recupera o mesmo pedido, sem duplicá-lo.</p>}{error && <p role="alert" id="checkout-error" className="form-error">{error}</p>}<Button type="submit" loading={busy}>{session ? 'Tentar novamente' : 'Criar pedido'}</Button>{session && canRevise && <Button variant="secondary" onClick={() => { try { sessionStorage.removeItem(key); setSession(undefined); setCanRevise(false); setError('') } catch { setError('Não foi possível liberar a tentativa neste navegador.') } }}>Revisar dados e sacola</Button>}</form>
}
