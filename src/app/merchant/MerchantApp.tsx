import type { OperationsGateway } from '../../modules/merchant/application/OperationsGateway'
import { OrdersPage, OrderDetail, InventoryPage } from './OperationsPages'
import { LayoutDashboard, Package, FolderTree, Store, LogOut, Menu, ChevronRight } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import logo from '../../assets/ats-logo.png'
import type { AuthService, SessionState } from '../../modules/auth/application/AuthService'
import type { CatalogView, MerchantGateway } from '../../modules/merchant/application/MerchantApplication'
import type { ActorContext } from '../../shared/domain/ActorContext'
import { feedback } from '../../modules/merchant/application/feedback'
import { Button } from '../../shared/ui/Button'
import { Drawer } from '../../shared/ui/Drawer'
import { Card } from '../../shared/ui/Card'
import { StateBox } from '../../shared/ui/Semantic'
import { Toast } from '../../shared/ui/Toast'
import { Login } from './Login'
import { ProductForm } from './ProductForm'
import { Categories, Dashboard, MyStore, ProductsList } from './Pages'
import { navigate, usePath } from './navigation'
import { routeDestination } from './routeGuard'
import '../../styles/merchant.css'

const links = [
  { path: '/painel', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/painel/produtos', label: 'Produtos', Icon: Package },
  { path: '/painel/categorias', label: 'Categorias', Icon: FolderTree },
  { path: '/painel/pedidos', label: 'Pedidos', Icon: Package },
  { path: '/painel/estoque', label: 'Estoque', Icon: FolderTree },
  { path: '/painel/minha-loja', label: 'Minha Loja', Icon: Store },
]
function Frame({ path, storeName, onLogout, children }: { path: string; storeName: string; onLogout(): void; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const nav = (mobile = false) => <nav aria-label={mobile ? 'Menu móvel do lojista' : 'Menu do lojista'}>{links.map(({ path: target, label, Icon }) => {
    const link = <a href={target} onClick={event => { event.preventDefault(); navigate(target); if (mobile) setMenuOpen(false) }} aria-current={(target === '/painel' ? path === target : path.startsWith(target)) ? 'page' : undefined}><Icon size={19} aria-hidden="true" /><span>{label}</span></a>
    return <div key={target}>{link}</div>
  })}</nav>
  return <div className="merchant-shell"><a className="skip-link" href="#merchant-content">Ir para o conteúdo</a><aside className="merchant-sidebar"><a href="/painel" className="merchant-brand"><img src={logo} alt="ATS" /><span>Loja Digital</span></a><div className="sidebar-store"><Store size={19} aria-hidden="true" /><div><small>Sua loja</small><strong>{storeName}</strong></div></div><span className="nav-eyebrow">Gerenciar</span>{nav()}<div className="sidebar-bottom"><span>Ambiente local</span><small>Firebase Emulator</small></div></aside>
    <div className="merchant-workspace"><header className="merchant-topbar"><div className="mobile-menu"><Drawer open={menuOpen} onOpenChange={setMenuOpen} trigger={<Button variant="ghost" aria-label="Abrir menu"><Menu size={21} aria-hidden="true" /></Button>} title="Menu do lojista" description={storeName}><div className="merchant-mobile-nav">{nav(true)}</div></Drawer></div><div className="merchant-breadcrumb"><span>Painel do Lojista</span><ChevronRight size={14} aria-hidden="true" /><strong>{links.find(l => l.path !== '/painel' && path.startsWith(l.path))?.label ?? 'Dashboard'}</strong></div><Button variant="ghost" onClick={onLogout}><LogOut size={17} aria-hidden="true" />Sair</Button></header><main id="merchant-content" className="merchant-main">{children}</main></div></div>
}
function MerchantPanel({ auth, merchant, actor, path, operations }: { auth: AuthService; merchant: MerchantGateway; operations?: OperationsGateway; actor: Extract<ActorContext, { role: 'MERCHANT' }>; path: string }) {
  const [view, setView] = useState<CatalogView>(), [loadError, setLoadError] = useState(''), [refresh, setRefresh] = useState(0)
  const [notice, setNotice] = useState(''), [actionError, setActionError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    void merchant.load(actor).then(value => { if (live) { setView(value); setLoadError('') } }, error => { if (live) setLoadError(feedback(error)) })
    return () => { live = false }
  }, [merchant, actor, refresh])
  const reload = () => { setNotice('Alteração salva.'); setRefresh(value => value + 1) }
  async function act(operation: () => Promise<unknown>) {
    setBusy(true); setActionError(''); setNotice('')
    try { await operation(); reload(); return true } catch (cause) { setActionError(feedback(cause)); return false } finally { setBusy(false) }
  }
  const logout = () => { void act(() => auth.signOut()) }
  let content: ReactNode
  if (loadError) content = <><StateBox kind="error" title="Não foi possível carregar sua loja" description={loadError} /><Button onClick={() => setRefresh(v => v + 1)}>Tentar novamente</Button></>
  else if (!view) content = <StateBox kind="loading" title="Carregando sua loja" description="Buscando as informações do catálogo." />
  else {
    const props = { view, merchant, actor, act, busy, reload, errorMessage: actionError }
    const title = path === '/painel' ? 'Visão geral' : path === '/painel/produtos/novo' ? 'Novo produto' : path.startsWith('/painel/produtos/') ? 'Editar produto' : path.startsWith('/painel/pedidos/') ? 'Detalhes do pedido' : links.find(l => l.path === path)?.label ?? 'Página não encontrada'
    const description = path === '/painel' ? 'Acompanhe seu catálogo e organize os próximos passos.' : 'Organização e controle para a operação da sua loja.'
    let page: ReactNode
    if (path === '/painel') page = <Dashboard view={view} />
    else if (path === '/painel/pedidos' && operations) page = <OrdersPage gateway={operations} />
    else if (path.startsWith('/painel/pedidos/') && operations) page = <OrderDetail key={path} gateway={operations} orderId={path.slice('/painel/pedidos/'.length)} canWrite={view.store.status === 'ACTIVE'} reload={reload} />
    else if (path === '/painel/estoque' && operations) page = <InventoryPage gateway={operations} view={view} reload={reload} />
    else if (path === '/painel/produtos') page = <ProductsList {...props} />
    else if (path === '/painel/categorias') page = <Categories {...props} />
    else if (path === '/painel/minha-loja') page = <MyStore {...props} />
    else if (path.startsWith('/painel/produtos/')) {
      const id = path.slice('/painel/produtos/'.length), product = view.products.find(p => p.id === id)
      page = id !== 'novo' && !product ? <StateBox kind="error" title="Produto não encontrado" description="Este produto não está disponível na sua loja." /> : <ProductForm key={id} view={view} product={product} onCancel={() => navigate('/painel/produtos')} onSave={async value => { await merchant.saveProduct(actor, value, product?.id); reload(); navigate('/painel/produtos') }} />
    } else page = <StateBox kind="empty" title="Página não encontrada" description="Use o menu para continuar." />
    content = <><div className="merchant-page-heading"><span className="eyebrow">{view.store.name}</span><h1>{title}</h1><p>{description}</p></div>{view.store.status === 'SUSPENDED' && <p className="notice" role="status">Loja suspensa. As informações estão disponíveis para consulta; alterações estão bloqueadas.</p>}{notice && <Toast>{notice}</Toast>}{actionError && <p className="form-error" role="alert">{actionError}</p>}{page}</>
  }
  return <Frame path={path} storeName={view?.store.name ?? 'Carregando…'} onLogout={logout}>{content}</Frame>
}
export function MerchantApp({ auth, merchant, operations }: { auth: AuthService; merchant: MerchantGateway; operations?: OperationsGateway }) {
  const [session, setSession] = useState<SessionState>({ status: 'LOADING' }), [logoutError, setLogoutError] = useState('')
  const path = usePath()
  useEffect(() => auth.observeSession(setSession), [auth])
  const destination = routeDestination(session, path)
  useEffect(() => { if (destination) navigate(destination, true) }, [destination])
  if (session.status === 'LOADING' || destination) return <main className="foundation"><StateBox kind="loading" title="Verificando acesso" description="Aguarde um instante." /></main>
  if (session.status === 'UNAUTHENTICATED') return <Login auth={auth} />
  if (session.status === 'ACCESS_DENIED' || (session.status === 'AUTHENTICATED' && session.actor.role === 'MASTER')) return <main className="foundation"><Card><h1>{session.status === 'ACCESS_DENIED' ? 'Acesso negado' : 'Área Master'}</h1><p>{session.status === 'ACCESS_DENIED' ? 'Seu perfil não está autorizado. Entre com outra conta ou solicite revisão do acesso.' : 'Perfil Master identificado. O painel administrativo global será implementado em sua fase própria.'}</p>{logoutError && <p role="alert">{logoutError}</p>}<Button onClick={() => { void auth.signOut().catch(error => setLogoutError(feedback(error))) }}>Sair da conta</Button></Card></main>
  if (session.status !== 'AUTHENTICATED' || session.actor.role !== 'MERCHANT') return null
  return <MotionConfig reducedMotion="user"><MerchantPanel key={session.actor.actorId} auth={auth} merchant={merchant} actor={session.actor} path={path} operations={operations} /></MotionConfig>
}
