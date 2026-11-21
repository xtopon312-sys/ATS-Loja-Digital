import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Storefront, ProductCard } from './Storefront'
import type { PublicCatalog, PublicCatalogRepository } from '../../modules/storefront/domain/PublicCatalog'
import { LocalCartStorage } from '../../modules/storefront/adapters/LocalCartStorage'

const catalog: PublicCatalog = { store: { storeId: 'a', slug: 'store-a', name: 'Store DEMO', themePreset: 'clean', publishable: true }, categories: [{ id: 'c', storeId: 'a', name: 'Categoria DEMO', publishable: true }, { id: 'empty', storeId: 'a', name: 'Vazia DEMO', publishable: true }], products: [{ id: 'p', storeId: 'a', name: 'Produto DEMO', description: 'Descrição', categoryId: 'c', priceCents: 1990, publishable: true, available: true, maxQuantity: 2 }] }
const repo = (value = catalog): PublicCatalogRepository => ({ load: async () => ({ status: 'READY', catalog: value }) })
afterEach(() => { cleanup(); localStorage.clear() })
describe('loja pública e sacola', () => {
  it('loading antes do catálogo', () => {
    render(<Storefront repository={{ load: () => new Promise(() => {}) }} slug="store-a" />)
    expect(screen.getByText('Carregando loja')).toBeInTheDocument()
  })
  it.each(['NOT_FOUND', 'UNAVAILABLE'] as const)('estado %s sem dados privados', async status => {
    render(<Storefront repository={{ load: async () => ({ status }) }} slug="store-a" />)
    expect(await screen.findByText(status === 'NOT_FOUND' ? 'Loja não encontrada' : 'Loja indisponível')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Abrir sacola/ })).not.toBeInTheDocument()
  })
  it('erro permite retry', async () => {
    const load = vi.fn<PublicCatalogRepository['load']>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ status: 'READY', catalog })
    render(<Storefront repository={{ load }} slug="store-a" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: 'Produto DEMO' })).toBeVisible()
  })
  it.each(['clean', 'dark'] as const)('mesma estrutura no tema %s', async themePreset => {
    const { container } = render(<Storefront repository={repo({ ...catalog, store: { ...catalog.store, themePreset } })} slug="store-a" />)
    await screen.findByRole('heading', { name: 'Produto DEMO' })
    expect(container.querySelector('[data-store-theme]')).toHaveAttribute('data-store-theme', themePreset)
    expect(screen.getByRole('searchbox', { name: 'Buscar produtos' })).toBeVisible()
    expect(screen.queryByText('Minha conta')).not.toBeInTheDocument()
  })
  it('busca/categoria filtram grid e exibem estados vazios', async () => {
    render(<Storefront repository={repo()} slug="store-a" />)
    const search = await screen.findByRole('searchbox')
    fireEvent.change(search, { target: { value: 'não existe' } })
    expect(screen.getByText('Nenhum resultado para sua busca')).toBeVisible()
    fireEvent.change(search, { target: { value: '' } })
    fireEvent.click(screen.getByRole('navigation', { name: 'Categorias' }).querySelectorAll('button')[2])
    expect(screen.getByText('Nenhum produto nesta categoria')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /^Todos$/ }))
    expect(screen.getByRole('heading', { name: 'Produto DEMO' })).toBeVisible()
  })
  it('catálogo sem produtos', async () => {
    render(<Storefront repository={repo({ ...catalog, products: [] })} slug="store-a" />)
    expect(await screen.findByText('Nenhum produto disponível')).toBeVisible()
  })
  it('card indisponível não adiciona e nunca mostra estoque', () => {
    const add = vi.fn()
    render(<ProductCard product={{ ...catalog.products[0], available: false, maxQuantity: 0 }} quantity={0} onAdd={add} />)
    expect(screen.getByRole('button')).toBeDisabled(); expect(screen.getByText('Indisponível')).toBeVisible()
    fireEvent.click(screen.getByRole('button')); expect(add).not.toHaveBeenCalled()
    expect(screen.queryByText(/estoque/i)).not.toBeInTheDocument()
  })
  it('sacola soma, limita, diminui e remove com controles acessíveis', async () => {
    render(<Storefront repository={repo()} slug="store-a" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar Produto DEMO à sacola' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir sacola, 1 itens' }))
    expect(screen.getByLabelText('Subtotal da sacola')).toHaveTextContent('19,90')
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade de Produto DEMO' }))
    expect(screen.getByLabelText('Subtotal da sacola')).toHaveTextContent('39,80')
    expect(screen.getByRole('button', { name: 'Aumentar quantidade de Produto DEMO' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir quantidade de Produto DEMO' }))
    expect(screen.getByLabelText('Quantidade de Produto DEMO')).toHaveTextContent('1')
    fireEvent.click(screen.getByRole('button', { name: 'Remover Produto DEMO' }))
    expect(screen.getByText('Sua sacola está vazia')).toBeVisible()
  })
  it('restaura/reconcilia armazenamento e avisa falha de persistência', async () => {
    localStorage.setItem('ats:cart:v1:a', JSON.stringify({ version: 1, storeId: 'a', items: [{ productId: 'p', quantity: 5 }] }))
    const storage = new LocalCartStorage({ getItem: key => localStorage.getItem(key), setItem: () => { throw new Error('quota') } })
    render(<Storefront repository={repo()} slug="store-a" storage={storage} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir sacola, 2 itens' }))
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir quantidade de Produto DEMO' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('apenas nesta visita'))
  })
})
