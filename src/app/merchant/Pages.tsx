import { useState, type FormEvent } from 'react'
import { ArrowRight, FolderTree, Package, Plus, Store as StoreIcon } from 'lucide-react'
import type { CatalogView, MerchantGateway } from '../../modules/merchant/application/MerchantApplication'
import type { ActorContext } from '../../shared/domain/ActorContext'
import { formatBRL } from '../../modules/merchant/application/money'
import { feedback } from '../../modules/merchant/application/feedback'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { Input } from '../../shared/ui/FormControls'
import { DomainStatusBadge, MetricCard, StateBox } from '../../shared/ui/Semantic'
import { AlertDialog } from '../../shared/ui/AlertDialog'
import { Table } from '../../shared/ui/Table'
import { CategoryForm } from './CategoryForm'
import { navigate } from './navigation'

type Act = (operation: () => Promise<unknown>) => Promise<boolean>
interface PageProps { view: CatalogView; merchant: MerchantGateway; actor: ActorContext; act: Act; busy: boolean; errorMessage?: string; reload(): void }
const productLabels = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', ARCHIVED: 'Arquivado' }

export function Dashboard({ view }: { view: CatalogView }) {
  return <><div className="merchant-metrics"><MetricCard label="Produtos utilizados" value={view.summary.productsUsed} detail={`de ${view.limits.maxProducts} disponíveis`} /><MetricCard label="Categorias utilizadas" value={view.summary.categoriesUsed} detail={`de ${view.limits.maxCategories} disponíveis`} /><MetricCard label="Produtos ativos" value={view.summary.activeProducts} detail="no seu catálogo" /><MetricCard label="Produtos inativos" value={view.summary.inactiveProducts} detail="também utilizam a cota" /></div>
    <div className="dashboard-grid"><Card><span className="eyebrow">Sua próxima ação</span><h2>{view.summary.productsUsed === 0 ? 'Vamos organizar sua loja?' : 'Seu catálogo, sempre atualizado'}</h2><p className="muted">{view.summary.productsUsed === 0 ? 'Comece criando uma categoria. Depois, cadastre o primeiro produto.' : 'Mantenha nomes, preços e categorias claros para facilitar a sua operação.'}</p><div className="start-steps"><button onClick={() => navigate('/painel/categorias')}><span>01</span><div><strong>Categorias</strong><small>Organize seus produtos</small></div><ArrowRight size={20} aria-hidden="true" /></button><button onClick={() => navigate('/painel/produtos/novo')} disabled={!view.canCreateProduct || !view.summary.categoriesUsed}><span>02</span><div><strong>Cadastrar produto</strong><small>Adicione informações e preço</small></div><ArrowRight size={20} aria-hidden="true" /></button></div></Card>
    <Card><span className="eyebrow">Seu plano</span><h2>Espaço para o essencial</h2><p className="muted">Produtos arquivados liberam espaço e preservam seu histórico.</p><div className="quota"><div><span>Produtos</span><strong>{view.summary.productsUsed} / {view.limits.maxProducts}</strong></div><progress aria-label="Cota de produtos" value={view.summary.productsUsed} max={view.limits.maxProducts} /></div><div className="quota"><div><span>Categorias</span><strong>{view.summary.categoriesUsed} / {view.limits.maxCategories}</strong></div><progress aria-label="Cota de categorias" value={view.summary.categoriesUsed} max={view.limits.maxCategories} /></div></Card></div></>
}

export function ProductsList({ view, merchant, actor, act, busy, errorMessage }: PageProps) {
  const [search, setSearch] = useState('')
  const visible = view.products.filter(p => p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  const blocked = busy || view.store.status !== 'ACTIVE'
  return <><div className="catalog-toolbar"><Input label="Buscar produto" value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite o nome" /><div><span className="usage-text">{view.summary.productsUsed} de {view.limits.maxProducts} produtos utilizados</span><Button disabled={!view.canCreateProduct || busy} onClick={() => navigate('/painel/produtos/novo')}><Plus size={17} aria-hidden="true" />Novo produto</Button></div></div>
    {!view.canCreateProduct && view.store.status === 'ACTIVE' && <p role="status" className="notice">Limite de produtos atingido. Arquive um produto para liberar espaço.</p>}
    {!visible.length ? <StateBox kind="empty" title={view.products.length ? 'Nenhum resultado' : 'Nenhum produto cadastrado'} description={view.products.length ? 'Tente buscar por outro nome.' : 'Crie uma categoria e cadastre seu primeiro produto.'} /> : <Card className="catalog-table"><Table><caption className="sr-only">Produtos da sua loja</caption><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td><div className="product-cell"><span className="product-thumb" aria-label="Sem imagem"><Package size={22} aria-hidden="true" /></span><strong>{p.name}</strong></div></td><td>{view.categories.find(c => c.id === p.categoryId)?.name ?? 'Categoria indisponível'}</td><td className="numeric">{formatBRL(p.priceCents)}</td><td className="numeric">{p.stock}</td><td><DomainStatusBadge status={p.status} label={productLabels[p.status]} /></td><td><div className="row-actions"><Button variant="ghost" disabled={busy} onClick={() => navigate(`/painel/produtos/${p.id}`)} aria-label={`Editar ${p.name}`}>Editar</Button>
      <Button variant="secondary" disabled={blocked || (p.status === 'ARCHIVED' && !view.canCreateProduct)} aria-label={`${p.status === 'ACTIVE' ? 'Inativar' : p.status === 'ARCHIVED' ? 'Reativar' : 'Ativar'} ${p.name}`} onClick={() => { void act(() => merchant.productStatus(actor, p.id, p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')) }}>{p.status === 'ACTIVE' ? 'Inativar' : p.status === 'ARCHIVED' ? 'Reativar' : 'Ativar'}</Button>
      {p.status !== 'ARCHIVED' && <AlertDialog errorMessage={errorMessage} trigger={<Button variant="ghost" disabled={blocked} aria-label={`Arquivar ${p.name}`}>Arquivar</Button>} title="Arquivar produto?" description={`“${p.name}” ficará arquivado. O histórico será preservado e a cota será liberada.`} onConfirm={() => act(() => merchant.productStatus(actor, p.id, 'ARCHIVED'))} />}</div></td></tr>)}</tbody></Table></Card>}
  </>
}

export function Categories({ view, merchant, actor, act, busy, reload, errorMessage }: PageProps) {
  const [editing, setEditing] = useState<string | undefined>()
  const selected = view.categories.find(c => c.id === editing)
  return <div className="categories-layout"><section><p className="usage-text">{view.summary.categoriesUsed} de {view.limits.maxCategories} categorias utilizadas</p>{view.categories.length === 0 ? <StateBox kind="empty" title="Nenhuma categoria cadastrada" description="Dê um nome à primeira categoria para organizar seus produtos." /> : <div className="category-list">{view.categories.map(c => <Card key={c.id}><div className="category-title"><FolderTree size={22} aria-hidden="true" /><h2>{c.name}</h2><DomainStatusBadge status={c.status} label={c.status === 'ACTIVE' ? 'Ativa' : 'Arquivada'} /></div><div className="row-actions"><Button variant="secondary" disabled={busy || view.store.status !== 'ACTIVE'} onClick={() => setEditing(c.id)} aria-label={`Editar ${c.name}`}>Editar nome</Button>{c.status === 'ARCHIVED' ? <Button disabled={busy || !view.canCreateCategory} onClick={() => { void act(() => merchant.categoryStatus(actor, c.id, 'ACTIVE')) }} aria-label={`Reativar ${c.name}`}>Reativar</Button> : <AlertDialog errorMessage={errorMessage} trigger={<Button variant="ghost" disabled={busy || view.store.status !== 'ACTIVE'} aria-label={`Arquivar ${c.name}`}>Arquivar</Button>} title="Arquivar categoria?" description={`“${c.name}” só poderá ser arquivada se não tiver produtos não arquivados associados.`} onConfirm={() => act(() => merchant.categoryStatus(actor, c.id, 'ARCHIVED'))} />}</div></Card>)}</div>}</section>
    <Card><h2>{selected ? 'Editar categoria' : 'Nova categoria'}</h2><p className="muted">Use nomes simples para facilitar a organização.</p>{!view.canCreateCategory && !selected && <p role="status" className="notice">Criação indisponível pela cota ou pela situação da loja.</p>}<CategoryForm key={editing ?? 'new'} initialName={selected?.name} disabled={busy || view.store.status !== 'ACTIVE' || (!selected && !view.canCreateCategory)} onCancel={selected ? () => setEditing(undefined) : undefined} onSave={async name => { await merchant.saveCategory(actor, name, selected?.id); setEditing(undefined); reload() }} /></Card></div>
}

export function MyStore({ view, merchant, actor, reload }: PageProps) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setSaved(false); setError('')
    const name = String(new FormData(event.currentTarget).get('name'))
    try { await merchant.renameStore(actor, name, String(new FormData(event.currentTarget).get('whatsapp') ?? '')); setSaved(true); reload() } catch (cause) { setError(feedback(cause)) } finally { setBusy(false) }
  }
  return <div className="product-form"><Card><h2>Informações da loja</h2><p className="muted">Mantenha o nome da sua loja atualizado.</p><form onSubmit={event => { void submit(event) }} className="merchant-fields" aria-busy={busy}><Input name="name" label="Nome da loja" defaultValue={view.store.name} required maxLength={120} disabled={busy || view.store.status !== 'ACTIVE'} aria-invalid={!!error} aria-describedby={error ? 'store-error' : undefined} /><Input name="whatsapp" label="WhatsApp da loja" defaultValue={view.store.whatsapp ?? ''} maxLength={32} hint="Inclua o código do país e DDD." disabled={busy || view.store.status !== 'ACTIVE'} /><Input label="Slug" value={view.store.slug} readOnly hint="O identificador de endereço é definido no provisionamento da loja." />{error && <p role="alert" id="store-error" className="form-error">{error}</p>}{saved && <p role="status">Nome da loja atualizado.</p>}<Button type="submit" loading={busy} disabled={view.store.status !== 'ACTIVE'}>Salvar loja</Button></form></Card><Card><StoreIcon size={32} aria-hidden="true" /><h2>Identidade visual</h2><p className="muted">Logo, banner e personalização da vitrine serão disponibilizados nas próximas etapas.</p></Card></div>
}
