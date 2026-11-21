import type { CheckoutGateway } from '../../modules/orders/application/Checkout'
import { CheckoutForm } from './CheckoutForm'
import { useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { ArrowDown, Minus, Package, Plus, Search, ShoppingBag, Trash2, Store, Info } from 'lucide-react'
import { getStoreThemeAttributes } from '../../modules/store-theme/application/StoreThemeEngine'
import { StoreThemeProvider } from '../../modules/store-theme/ui/StoreThemeProvider'
import { filterProducts, type CatalogResult, type PublicCatalog, type PublicCatalogRepository, type PublicProduct } from '../../modules/storefront/domain/PublicCatalog'
import { changeCart, reconcileCart, type CartView } from '../../modules/storefront/domain/Cart'
import { LocalCartStorage, type CartStorage } from '../../modules/storefront/adapters/LocalCartStorage'
import { formatBRL } from '../../modules/merchant/application/money'
import { Drawer } from '../../shared/ui/Drawer'
import { StateBox } from '../../shared/ui/Semantic'
import { Button } from '../../shared/ui/Button'
import '../../styles/storefront.css'

function browserStorage(): CartStorage {
  return new LocalCartStorage({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) })
}
export function ProductCard({ product, quantity, onAdd }: { product: PublicProduct; quantity: number; onAdd(): void }) {
  return <article className="public-product"><div className="public-product-image" aria-label={product.imageUrl ? undefined : 'Produto sem imagem'}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <><Package size={56} strokeWidth={1.2} aria-hidden="true" /><span>Imagem ilustrativa indisponível</span></>}</div><div className="public-product-body"><span className="public-availability">{product.available ? 'Disponível' : 'Indisponível'}</span><h3>{product.name}</h3><p>{product.description}</p><strong className="public-price">{formatBRL(product.priceCents)}</strong><button className="store-action" disabled={!product.available || quantity >= product.maxQuantity} onClick={onAdd} aria-label={`Adicionar ${product.name} à sacola`}><Plus size={18} aria-hidden="true" />{quantity >= product.maxQuantity && product.available ? 'Limite na sacola' : 'Adicionar à sacola'}</button></div></article>
}
function Cart({ cart, onChange, onClear }: { cart: CartView; onChange(id: string, quantity: number): void; onClear(): void }) {
  return <section className="public-cart" aria-label="Itens da sacola">{!cart.lines.length ? <div className="public-empty"><ShoppingBag size={38} aria-hidden="true" /><h3>Sua sacola está vazia</h3><p>Explore o catálogo e adicione um produto.</p></div> : <><ul>{cart.lines.map(line => <li key={line.productId}><div className="cart-line-head"><h3>{line.product.name}</h3><button className="public-icon" onClick={() => onChange(line.productId, 0)} aria-label={`Remover ${line.product.name}`}><Trash2 size={18} aria-hidden="true" /></button></div><p>{formatBRL(line.product.priceCents)} por unidade</p><div className="cart-line-controls"><div className="quantity-control"><button aria-label={`Diminuir quantidade de ${line.product.name}`} disabled={line.quantity === 1} onClick={() => onChange(line.productId, line.quantity - 1)}><Minus size={16} aria-hidden="true" /></button><output aria-label={`Quantidade de ${line.product.name}`}>{line.quantity}</output><button aria-label={`Aumentar quantidade de ${line.product.name}`} disabled={line.quantity >= line.product.maxQuantity} onClick={() => onChange(line.productId, line.quantity + 1)}><Plus size={16} aria-hidden="true" /></button></div><strong>{formatBRL(line.subtotalCents)}</strong></div><small>Limite atual de seleção: {line.product.maxQuantity}</small></li>)}</ul><button className="public-text-button" onClick={onClear}>Limpar sacola</button></>}<div className="public-cart-total"><span>Subtotal · {cart.quantity} {cart.quantity === 1 ? 'item' : 'itens'}</span><strong aria-label="Subtotal da sacola">{formatBRL(cart.subtotalCents)}</strong></div><p className="public-cart-note">A sacola não reserva produtos. A loja confirmará a disponibilidade do pedido.</p></section>
}
function StorefrontShell({ catalog, storage, checkout }: { catalog: PublicCatalog; storage: CartStorage; checkout?: CheckoutGateway }) {
  const [initial] = useState(() => storage.read(catalog.store.storeId))
  const [items, setItems] = useState(initial.items), [storageFailed, setStorageFailed] = useState(initial.failed)
  const [search, setSearch] = useState(''), [categoryId, setCategoryId] = useState(''), [message, setMessage] = useState('')
  const cart = reconcileCart(items, catalog), visible = filterProducts(catalog, search, categoryId)
  useEffect(() => { storage.write(catalog.store.storeId, reconcileCart(initial.items, catalog).items) }, [storage, catalog, initial])
  function change(id: string, quantity: number) {
    const next = changeCart(cart.items, catalog, id, quantity)
    setItems(next.items); if (!storage.write(catalog.store.storeId, next.items)) setStorageFailed(true)
    setMessage('Sacola atualizada.')
  }
  function clear() { setItems([]); if (!storage.write(catalog.store.storeId, [])) setStorageFailed(true); setMessage('Sacola esvaziada.') }
  const categories = catalog.categories.filter(c => c.publishable)
  return <StoreThemeProvider initialTheme={catalog.store.themePreset}><div className="public-storefront"><a className="skip-link" href="#public-catalog">Ir para produtos</a><header className="public-header"><div className="public-header-inner"><a className="public-brand" href={`/loja/${catalog.store.slug}`}><span className="public-logo" aria-hidden="true"><Store size={26} /></span><span>{catalog.store.name}</span></a><label className="public-search"><Search size={19} aria-hidden="true" /><span className="sr-only">Buscar produtos</span><input type="search" placeholder="O que você procura?" value={search} onChange={e => setSearch(e.target.value)} /></label><Drawer trigger={<button className="public-cart-trigger" aria-label={`Abrir sacola, ${cart.quantity} itens`}><ShoppingBag size={21} aria-hidden="true" /><span>Sacola</span><b>{cart.quantity}</b></button>} title="Sua sacola" description={catalog.store.name} contentProps={{ className: 'ui-drawer public-cart-drawer store-theme', ...getStoreThemeAttributes(catalog.store.themePreset) }}><StoreThemeProvider initialTheme={catalog.store.themePreset}><Cart cart={cart} onChange={change} onClear={clear} />{checkout && <CheckoutForm store={catalog.store} items={cart.items} gateway={checkout} onCreated={clear} />}</StoreThemeProvider></Drawer></div><nav className="public-categories" aria-label="Categorias"><button aria-pressed={!categoryId} onClick={() => setCategoryId('')}>Todos</button>{categories.map(c => <button key={c.id} aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>{c.name}</button>)}</nav></header>
    <main className="public-main"><section className="public-hero"><div><span className="public-eyebrow">Conheça nossa seleção</span><h1>Encontre o que combina<br />com o seu dia.</h1><p>Explore os produtos de {catalog.store.name} e organize sua sacola.</p><a className="store-action" href="#public-catalog">Explorar produtos <ArrowDown size={18} aria-hidden="true" /></a></div><div className="hero-placeholder" aria-label="Espaço ilustrativo da loja"><Package size={100} strokeWidth={.8} aria-hidden="true" /><span>Seu próximo favorito<br />pode estar aqui.</span></div></section>
    {!!categories.length && <section className="featured-categories" aria-label="Explore por categoria">{categories.map(c => <button key={c.id} onClick={() => setCategoryId(c.id)}><Package size={22} aria-hidden="true" /><span>{c.name}</span></button>)}</section>}
    <section id="public-catalog" className="public-catalog"><div className="public-section-title"><div><span className="public-eyebrow">Catálogo</span><h2>{categoryId ? categories.find(c => c.id === categoryId)?.name : 'Todos os produtos'}</h2></div><span>{visible.length} {visible.length === 1 ? 'produto' : 'produtos'}</span></div><p className="sr-only" role="status">{message}</p>{storageFailed && <p role="alert" className="public-storage-warning">Não foi possível salvar a sacola neste navegador. Ela será mantida apenas nesta visita.</p>}{!visible.length ? <div className="public-empty"><Package size={38} aria-hidden="true" /><h3>{!catalog.products.length ? 'Nenhum produto disponível' : search ? 'Nenhum resultado para sua busca' : 'Nenhum produto nesta categoria'}</h3><p>{!catalog.products.length ? 'Volte em breve para conhecer as novidades.' : 'Experimente outra busca ou categoria.'}</p></div> : <div className="public-product-grid">{visible.map(p => <ProductCard key={p.id} product={p} quantity={cart.items.find(i => i.productId === p.id)?.quantity ?? 0} onAdd={() => change(p.id, (cart.items.find(i => i.productId === p.id)?.quantity ?? 0) + 1)} />)}</div>}</section>
    <section className="public-information"><Info size={25} aria-hidden="true" /><div><h2>Uma sacola para organizar suas escolhas</h2><p>Preços e disponibilidade podem mudar. Pedidos ficam pendentes até a confirmação da loja. Não há pagamento online.</p></div></section></main><footer className="public-footer"><strong>{catalog.store.name}</strong><span>Catálogo da loja · ATS Loja Digital</span></footer></div></StoreThemeProvider>
}
export function Storefront({ repository, slug, storage, checkout }: { repository: PublicCatalogRepository; slug: string; storage?: CartStorage; checkout?: CheckoutGateway }) {
  const [cartStorage] = useState(() => storage ?? browserStorage())
  const [result, setResult] = useState<CatalogResult>(), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => { let live = true
    void repository.load(slug).then(value => { if (live) { setResult(value); setError(false) } }, () => { if (live) setError(true) })
    return () => { live = false }
  }, [repository, slug, attempt])
  if (error) return <main className="foundation"><StateBox kind="error" title="Não foi possível carregar o catálogo" description="Tente novamente em instantes." /><Button onClick={() => { setError(false); setAttempt(v => v + 1) }}>Tentar novamente</Button></main>
  if (!result) return <main className="foundation"><StateBox kind="loading" title="Carregando loja" description="Preparando o catálogo." /></main>
  if (result.status !== 'READY') return <main className="foundation"><StateBox kind="empty" title={result.status === 'NOT_FOUND' ? 'Loja não encontrada' : 'Loja indisponível'} description="Não foi possível abrir esta loja. Confira o endereço ou tente novamente mais tarde." /></main>
  return <MotionConfig reducedMotion="user"><StorefrontShell key={result.catalog.store.storeId + result.catalog.store.themePreset} catalog={result.catalog} storage={cartStorage} checkout={checkout} /></MotionConfig>
}
