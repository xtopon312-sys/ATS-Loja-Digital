import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Dialog } from './Dialog'
import { Drawer } from './Drawer'
import { Input } from './FormControls'
import { DomainStatusBadge, MetricCard, StatusBadge } from './Semantic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs'
import { Button } from './Button'

describe('componentes do Design System ATS 2.0', () => {
  it('associa o label ao Input e preserva estado disabled', () => {
    render(<Input label="Nome da loja" disabled />)
    expect(screen.getByRole('textbox', { name: 'Nome da loja' })).toBeDisabled()
  })

  it('Dialog abre, recebe foco, fecha por Escape e devolve foco ao acionador', async () => {
    render(<Dialog trigger={<Button>Abrir confirmação</Button>} title="Confirmar ação" description="Ação demonstrativa." />)
    const trigger = screen.getByRole('button', { name: 'Abrir confirmação' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Confirmar ação' })
    expect(dialog).toBeInTheDocument()
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmar ação' })).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('Drawer expõe nome acessível e fecha pelo controle visível', async () => {
    render(<Drawer trigger={<Button>Abrir detalhes</Button>} title="Detalhes laterais" description="Painel demonstrativo." />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes' }))
    expect(screen.getByRole('dialog', { name: 'Detalhes laterais' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Detalhes laterais' })).not.toBeInTheDocument())
  })

  it('Tabs alterna painéis por teclado', async () => {
    render(<Tabs defaultValue="one"><TabsList aria-label="Seções"><TabsTrigger value="one">Primeiro</TabsTrigger><TabsTrigger value="two">Segundo</TabsTrigger></TabsList><TabsContent value="one">Painel um</TabsContent><TabsContent value="two">Painel dois</TabsContent></Tabs>)
    const first = screen.getByRole('tab', { name: 'Primeiro' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Segundo' })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByText('Painel dois')).toBeVisible()
  })

  it('StatusBadge comunica estado por ícone oculto e texto visível', () => {
    render(<StatusBadge status="warning" />)
    expect(screen.getByText('Atenção')).toBeVisible()
    expect(screen.getByText('Atenção').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('MetricCard oferece nome e valor acessíveis', () => {
    render(<MetricCard label="Temas" value={6} detail="presets" />)
    expect(screen.getByLabelText('Temas: 6')).toBeInTheDocument()
    expect(screen.getByText('presets')).toBeVisible()
  })

  it('representa status do domínio por texto e ícone', () => {
    render(<DomainStatusBadge status="SUSPENDED" />)
    expect(screen.getByText('SUSPENDED')).toBeVisible()
    expect(screen.getByText('SUSPENDED').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
