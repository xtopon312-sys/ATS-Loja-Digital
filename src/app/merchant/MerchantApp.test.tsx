import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthService, SessionState } from '../../modules/auth/application/AuthService'
import type { CatalogView, MerchantGateway } from '../../modules/merchant/application/MerchantApplication'
import { DomainError } from '../../shared/domain/DomainError'
import { MerchantApp } from './MerchantApp'
import { Login } from './Login'
import { ProductForm } from './ProductForm'
import { CategoryForm } from './CategoryForm'
import { Dashboard, ProductsList } from './Pages'
import { routeDestination } from './routeGuard'
import { parseBRLCents } from '../../modules/merchant/application/money'

const actor = { role: 'MERCHANT', storeId: 'a', actorId: 'merchant-a' } as const
const now = '2026-09-05T12:00:00.000Z'
const empty: CatalogView = {
  store: { id: 'a', name: 'Store A DEMO', slug: 'store-a-demo', planId: 'ats-loja-digital', billingStatus: 'PENDING', status: 'ACTIVE', createdAt: now, updatedAt: now },
  products: [], categories: [], limits: { maxProducts: 50, maxCategories: 5 }, summary: { productsUsed: 0, categoriesUsed: 0, activeProducts: 0, inactiveProducts: 0 }, canCreateProduct: true, canCreateCategory: true,
}
function authentication(state: SessionState): AuthService {
  return { signIn: vi.fn().mockResolvedValue(undefined), signOut: vi.fn().mockResolvedValue(undefined), observeSession: observer => { observer(state); return () => {} } }
}
function gateway(view = empty): MerchantGateway {
  return { load: vi.fn().mockResolvedValue(view), saveProduct: vi.fn(), productStatus: vi.fn(), saveCategory: vi.fn(), categoryStatus: vi.fn(), renameStore: vi.fn() }
}
beforeEach(() => { history.replaceState(null, '', '/painel'); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); history.replaceState(null, '', '/') })

describe('fronteira monetária', () => {
  it.each([['R$ 0,00', 0], ['R$ 19,90', 1990], ['R$ 1.299,90', 129990], ['59,90', 5990]])('converte %s em centavos inteiros', (value, cents) => { expect(parseBRLCents(value)).toBe(cents) })
  it.each(['-1,00', '1,999', 'abc', '', '1.2,00', '1,2', '19.90', 'Infinity', '9007199254740991000,00'])('rejeita %s', value => { expect(() => parseBRLCents(value)).toThrow(DomainError) })
})
describe('login e guards', () => {
  it('login mantém labels, bloqueia envio durante espera e envia credenciais pelo contrato', async () => {
    let release!: () => void
    const auth = authentication({ status: 'UNAUTHENTICATED' })
    auth.signIn = vi.fn(() => new Promise<void>(resolve => { release = resolve }))
    render(<Login auth={auth} />)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'demo@example.test' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'local-password' } })
    fireEvent.click(screen.getByRole('button', { name: /Entrar no painel/ }))
    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    expect(auth.signIn).toHaveBeenCalledWith('demo@example.test', 'local-password')
    release()
    await waitFor(() => expect(screen.getByRole('button', { name: /Entrar no painel/ })).toBeEnabled())
  })
  it('credencial inválida recebe erro associado, sem expor detalhe do SDK', async () => {
    const auth = authentication({ status: 'UNAUTHENTICATED' })
    auth.signIn = vi.fn().mockRejectedValue({ code: 'auth/invalid-credential' })
    render(<Login auth={auth} />)
    fireEvent.submit(screen.getByLabelText('E-mail').closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-describedby', 'login-error')
  })
  it('guard redireciona visitante para login sem ler catálogo', async () => {
    const merchant = gateway()
    render(<MerchantApp auth={authentication({ status: 'UNAUTHENTICATED' })} merchant={merchant} />)
    expect(await screen.findByRole('heading', { name: 'Acesse sua loja' })).toBeVisible()
    expect(location.pathname).toBe('/login'); expect(merchant.load).not.toHaveBeenCalled()
  })
  it('MASTER tem tela própria e não carrega catálogo Merchant', async () => {
    const merchant = gateway()
    render(<MerchantApp auth={authentication({ status: 'AUTHENTICATED', actor: { role: 'MASTER', actorId: 'master' } })} merchant={merchant} />)
    expect(await screen.findByRole('heading', { name: 'Área Master' })).toBeVisible()
    expect(location.pathname).toBe('/master'); expect(merchant.load).not.toHaveBeenCalled()
  })
  it('perfil negado não mostra dados comerciais', async () => {
    const merchant = gateway()
    render(<MerchantApp auth={authentication({ status: 'ACCESS_DENIED' })} merchant={merchant} />)
    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeVisible()
    expect(merchant.load).not.toHaveBeenCalled()
  })
  it('sessão em resolução mantém loading; Merchant válido continua em /painel', () => {
    expect(routeDestination({ status: 'LOADING' }, '/painel')).toBeUndefined()
    expect(routeDestination({ status: 'AUTHENTICATED', actor }, '/painel')).toBeUndefined()
    expect(routeDestination({ status: 'AUTHENTICATED', actor }, '/login')).toBe('/painel')
  })
})
describe('painel e catálogo', () => {
  it('dashboard vazio orienta categoria antes de produto, sem inventar vendas', () => {
    render(<Dashboard view={empty} />)
    expect(screen.getByText('Vamos organizar sua loja?')).toBeVisible()
    expect(screen.getByRole('button', { name: /Cadastrar produto/ })).toBeDisabled()
    expect(screen.queryByText(/Receita|Ticket médio/)).not.toBeInTheDocument()
  })
  it('consulta pendente expõe LoadingState', () => {
    const merchant = gateway(); merchant.load = vi.fn(() => new Promise<CatalogView>(() => {}))
    render(<MerchantApp auth={authentication({ status: 'AUTHENTICATED', actor })} merchant={merchant} />)
    expect(screen.getByText('Carregando sua loja')).toBeVisible()
  })
  it('falha de consulta oferece erro e tentativa novamente', async () => {
    const merchant = gateway(); merchant.load = vi.fn().mockRejectedValue(new Error('offline'))
    render(<MerchantApp auth={authentication({ status: 'AUTHENTICATED', actor })} merchant={merchant} />)
    expect(await screen.findByText('Não foi possível carregar sua loja')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(merchant.load).toHaveBeenCalledTimes(2))
  })
  it('listagem vazia tem orientação e busca sem tabela quebrada', () => {
    render(<ProductsList view={empty} merchant={gateway()} actor={actor} act={vi.fn()} busy={false} reload={() => {}} />)
    expect(screen.getByText('Nenhum produto cadastrado')).toBeVisible()
    expect(screen.getByLabelText('Buscar produto')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('quota atingida desabilita cadastro e reativação, mantendo edição disponível', () => {
    const view: CatalogView = { ...empty, canCreateProduct: false, summary: { ...empty.summary, productsUsed: 50 }, products: [{ id: 'p', storeId: 'a', name: 'DEMO', description: '', categoryId: 'c', status: 'ARCHIVED', stock: 0, priceCents: 0, createdAt: now, updatedAt: now }] }
    render(<ProductsList view={view} merchant={gateway()} actor={actor} act={vi.fn()} busy={false} reload={() => {}} />)
    expect(screen.getByRole('button', { name: 'Novo produto' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reativar DEMO' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Editar DEMO' })).toBeEnabled()
  })
  it('arquivamento pede confirmação e Escape mantém o produto', async () => {
    const view: CatalogView = { ...empty, products: [{ id: 'p', storeId: 'a', name: 'DEMO', description: '', categoryId: 'c', status: 'ACTIVE', stock: 0, priceCents: 0, createdAt: now, updatedAt: now }] }
    const merchant = gateway(), act = vi.fn(async operation => { await operation(); return true })
    render(<ProductsList view={view} merchant={merchant} actor={actor} act={act} busy={false} reload={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar DEMO' }))
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus())
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(merchant.productStatus).not.toHaveBeenCalled()
  })
  it('formulário de produto associa erro monetário e preserva valores', async () => {
    const view: CatalogView = { ...empty, categories: [{ id: 'c', storeId: 'a', name: 'DEMO', status: 'ACTIVE', createdAt: now, updatedAt: now }] }
    render(<ProductForm view={view} onCancel={() => {}} onSave={async () => { throw new DomainError('INVALID_PRICE') }} />)
    fireEvent.change(screen.getByLabelText('Preço (R$)'), { target: { value: '1,999' } })
    fireEvent.submit(screen.getByLabelText('Preço (R$)').closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe um preço válido')
    expect(screen.getByLabelText('Preço (R$)')).toHaveValue('1,999')
  })
  it('edição de produto mantém estoque readOnly e não oferece estoque inicial', () => {
    const product = { id: 'p', storeId: 'a', name: 'DEMO', description: '', categoryId: 'c', status: 'ACTIVE' as const, stock: 3, priceCents: 1990, createdAt: now, updatedAt: now }
    render(<ProductForm view={empty} product={product} onCancel={() => {}} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Estoque atual')).toHaveAttribute('readonly')
    expect(screen.queryByLabelText('Quantidade em estoque')).not.toBeInTheDocument()
  })
  it('categoria mostra quota negada como erro do caso de uso', async () => {
    render(<CategoryForm onSave={async () => { throw new DomainError('CATEGORY_LIMIT_REACHED') }} />)
    fireEvent.submit(screen.getByLabelText('Nome da categoria').closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('5 categorias')
    expect(screen.getByLabelText('Nome da categoria')).toHaveAttribute('aria-describedby', 'category-error')
  })
})
