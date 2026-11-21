import { Bell, Check, Layers3, Menu, Palette, Search, ShoppingBag, Sparkles } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { useState } from 'react'

import atsLogo from '../assets/ats-logo.png'
import { STORE_THEME_IDS, STORE_THEME_PRESETS } from '../modules/store-theme/domain/StoreTheme'
import { StoreThemeProvider } from '../modules/store-theme/ui/StoreThemeProvider'
import { StoreProductCardDemo } from '../modules/store-theme/ui/StoreProductCardDemo'
import { useStoreTheme } from '../modules/store-theme/ui/useStoreTheme'
import { BlurFade } from '../shared/motion/BlurFade'
import { Badge } from '../shared/ui/Badge'
import { Button } from '../shared/ui/Button'
import { Card } from '../shared/ui/Card'
import { Dialog } from '../shared/ui/Dialog'
import { Drawer } from '../shared/ui/Drawer'
import { Checkbox, Input, Select, Textarea } from '../shared/ui/FormControls'
import { DomainStatusBadge, MetricCard, PageHeader, StateBox, StatusBadge } from '../shared/ui/Semantic'
import { Skeleton } from '../shared/ui/Skeleton'
import { Switch } from '../shared/ui/Switch'
import { Table } from '../shared/ui/Table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../shared/ui/Tabs'
import { Toast } from '../shared/ui/Toast'
import { Tooltip, TooltipProvider } from '../shared/ui/Tooltip'

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="ds-section-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div></div>
}

function CartDemo() {
  return <aside className="cart-demo" aria-label="Sacola demonstrativa"><h3>Sacola visual</h3>{[1, 2].map((item) => <div className="cart-demo-item" key={item}><span className="cart-demo-thumb" /><div><strong>Item demonstrativo {item}</strong><span>Sem operação comercial</span></div></div>)}<div className="cart-demo-total"><span>Total</span><span>R$ —</span></div><button type="button" className="store-action">Continuar demonstração</button><p className="storefront-note">Componente visual. Checkout e persistência estão fora desta fase.</p></aside>
}

function StorefrontPreview() {
  const { themeId, setThemeId } = useStoreTheme()
  return (
    <>
      <div className="theme-picker" aria-label="Escolha de tema da loja">
        {STORE_THEME_IDS.map((id) => <button key={id} type="button" aria-pressed={themeId === id} onClick={() => setThemeId(id)}>{STORE_THEME_PRESETS[id].name}</button>)}
      </div>
      <div className="storefront" aria-label={`Vitrine demonstrativa no tema ${STORE_THEME_PRESETS[themeId].name}`}>
        <header className="storefront-header">
          <span className="storefront-mark" aria-hidden="true">LD</span>
          <span className="storefront-search"><Search size={14} aria-hidden="true" style={{ display: 'inline', marginRight: '.4rem' }} />Buscar na loja demonstrativa</span>
          <Drawer trigger={<button type="button" className="storefront-cart"><ShoppingBag size={18} aria-hidden="true" /> Sacola</button>} title="Sacola demonstrativa" description="DEMO: sem checkout ou persistência."><StoreThemeProvider initialTheme={themeId}><CartDemo /></StoreThemeProvider></Drawer>
        </header>
        <div className="storefront-body">
          <section className="storefront-main" aria-label="Produtos demonstrativos">
            <section className="storefront-banner"><small>DEMO · Coleção demonstrativa</small><h3>Uma vitrine com a sua identidade</h3><p>Estrutura fixa, tokens de marca controlados e conteúdo neutro para validar os seis presets.</p></section>
            <nav className="storefront-categories" aria-label="Categorias demonstrativas">{['Novidades', 'Coleção', 'Essenciais', 'Destaques'].map((label) => <span className="storefront-category" key={label}>{label}</span>)}</nav>
            <div className="product-grid">
              {[1, 2, 3].map((item) => <StoreProductCardDemo index={item} key={item} />)}
            </div>
          </section>
          <CartDemo />
        </div>
      </div>
    </>
  )
}

export function DesignSystemPage() {
  const [toastVisible, setToastVisible] = useState(false)
  return (
    <MotionConfig reducedMotion="user">
      <div className="ds-shell">
        <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
        <header className="ds-topbar">
          <a className="ds-brand" href="/design-system" aria-label="ATS Design System"><img src={atsLogo} alt="ATS" /><span className="ds-brand-copy"><strong>Design System 2.0</strong><span>Ambiente interno · Fase 4</span></span></a>
          <nav className="ds-nav" aria-label="Seções do design system"><a href="#fundamentos">Fundamentos</a><a href="#componentes">Componentes</a><a href="#temas">Temas</a></nav>
        </header>
        <main className="ds-page" id="conteudo">
          <BlurFade><section className="ds-hero"><div><span className="eyebrow"><Sparkles size={15} aria-hidden="true" /> ATS Admin Theme</span><h1>Consistência para operar. Liberdade para cada marca.</h1><p>Fundação visual acessível e responsiva para os ambientes administrativos e para vitrines temáveis, sem iniciar a interface comercial.</p></div><aside className="hero-note"><strong>Escopo controlado</strong><p>Tokens, componentes, estados, movimento e seis presets locais. Toda informação desta página é demonstrativa.</p></aside></section></BlurFade>

          <section className="ds-section" id="fundamentos"><SectionHeader eyebrow="01 · Fundamentos" title="Tokens ATS Admin" description="Cor, tipografia, espaçamento, raio, sombra e foco organizados em variáveis semânticas." /><div className="ds-grid">
            {[['Ciano', 'var(--admin-primary)'], ['Violeta', 'var(--admin-secondary)'], ['Laranja', 'var(--admin-accent)']].map(([name, color]) => <div className="ds-span-4 token-swatch" style={{ background: color }} key={name}><span>Token de marca</span><strong>{name} · {color}</strong></div>)}
            <Card className="ds-span-6"><span className="eyebrow">Escala tipográfica</span><h2 className="text-3xl font-extrabold tracking-tight">Título de interface</h2><p className="text-base text-[var(--admin-muted)]">Texto funcional com leitura confortável.</p><small className="text-xs text-[var(--admin-muted)]">Metadado e apoio contextual</small></Card>
            <Card className="ds-span-6"><span className="eyebrow">Forma e profundidade</span><div className="demo-row"><span style={{ width: 62, height: 62, borderRadius: 'var(--radius-sm)', background: 'var(--admin-surface-raised)' }} /><span style={{ width: 62, height: 62, borderRadius: 'var(--radius-lg)', background: 'var(--admin-surface-raised)', boxShadow: 'var(--shadow-glow)' }} /><span style={{ width: 62, height: 62, borderRadius: '50%', background: 'linear-gradient(135deg,var(--admin-primary),var(--admin-secondary))' }} /></div></Card>
            <Card className="ds-span-12"><span className="eyebrow">Spacing e motion presets</span><div className="demo-row"><Badge>space-2 · 8px</Badge><Badge>space-4 · 16px</Badge><Badge>space-8 · 32px</Badge><Badge tone="brand">fast · 120ms</Badge><Badge tone="brand">normal · 220ms</Badge><Badge tone="brand">slow · 420ms</Badge></div></Card>
          </div></section>

          <section className="ds-section" id="componentes"><SectionHeader eyebrow="02 · Primitives" title="Componentes interativos" description="Base shadcn/ui com Radix, ícones Lucide e estados acessíveis para teclado e leitores de tela." /><div className="ds-grid">
            <div className="demo-panel ds-span-8"><h3>Button e Badge</h3><p className="demo-caption">Variantes semânticas, loading, disabled e status com ícone + texto.</p><div className="demo-row"><Button>Primário</Button><Button variant="secondary">Secundário</Button><Button variant="ghost">Ghost</Button><Button variant="destructive">Destrutivo</Button><Button loading>Salvar</Button><Button disabled>Desabilitado</Button></div><div className="demo-row" style={{ marginTop: '1rem' }}>{(['active', 'pending', 'warning', 'error'] as const).map((status) => <StatusBadge status={status} key={status} />)}</div></div>
            <div className="demo-panel ds-span-4"><h3>Switch e Checkbox</h3><p className="demo-caption">Controles com nome acessível.</p><div className="demo-row"><Switch aria-label="Ativar notificações" defaultChecked /><Checkbox label="Receber resumo" defaultChecked /></div></div>
            <div className="demo-panel ds-span-6"><h3>Formulários</h3><p className="demo-caption">Labels persistentes e dicas associadas.</p><div className="grid gap-3"><Input label="Nome da configuração" placeholder="Ex.: Vitrine principal" hint="Campo demonstrativo" /><Select label="Preset inicial" defaultValue="clean">{STORE_THEME_IDS.map((id) => <option value={id} key={id}>{STORE_THEME_PRESETS[id].name}</option>)}</Select><Textarea label="Observação" placeholder="Descreva o objetivo visual" /></div></div>
            <div className="demo-panel ds-span-6"><h3>Dialog, Drawer e Tooltip</h3><p className="demo-caption">Foco gerenciado, Escape e retorno ao acionador.</p><div className="demo-row"><Dialog trigger={<Button variant="secondary">Abrir diálogo</Button>} title="Confirmação demonstrativa" description="Nenhuma alteração persistente será executada."><Badge tone="info">Contexto local</Badge></Dialog><Drawer trigger={<Button variant="secondary"><Menu size={16} aria-hidden="true" />Abrir painel</Button>} title="Painel lateral" description="Estrutura para ações contextuais."><StateBox kind="empty" title="Painel vazio" description="Conteúdo será definido em uma fase futura." /></Drawer><TooltipProvider><Tooltip label="Notificações demonstrativas"><button className="ui-icon-button" aria-label="Notificações"><Bell size={18} /></button></Tooltip></TooltipProvider></div></div>
            <div className="demo-panel ds-span-6"><h3>Tabs</h3><p className="demo-caption">Setas direcionais alternam os painéis.</p><Tabs defaultValue="overview"><TabsList aria-label="Exemplo de navegação"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="details">Detalhes</TabsTrigger><TabsTrigger value="history">Histórico</TabsTrigger></TabsList><TabsContent value="overview">Resumo da configuração visual.</TabsContent><TabsContent value="details">Tokens e decisões do preset.</TabsContent><TabsContent value="history">Nenhum histórico persistido nesta fase.</TabsContent></Tabs></div>
            <div className="demo-panel ds-span-6"><h3>Feedback</h3><p className="demo-caption">Toast explícito e skeleton com movimento reduzível.</p><Button variant="secondary" onClick={() => setToastVisible((visible) => !visible)}>Alternar feedback</Button>{toastVisible && <div style={{ marginTop: '1rem' }}><Toast><strong>Preferência aplicada</strong><div>Somente nesta demonstração local.</div></Toast></div>}<div style={{ display: 'grid', gap: '.55rem', marginTop: '1rem' }}><Skeleton style={{ width: '80%' }} /><Skeleton style={{ width: '55%' }} /></div></div>
            <div className="demo-panel ds-span-12"><h3>Table responsiva</h3><p className="demo-caption">Rolagem horizontal restrita ao componente em telas estreitas.</p><Table><thead><tr><th>Preset</th><th>Densidade</th><th>Tipografia</th><th>Status</th></tr></thead><tbody>{STORE_THEME_IDS.slice(0, 4).map((id) => <tr key={id}><td>{STORE_THEME_PRESETS[id].name}</td><td>{STORE_THEME_PRESETS[id].density}</td><td>{STORE_THEME_PRESETS[id].typography}</td><td><StatusBadge status="active" /></td></tr>)}</tbody></Table></div>
            <div className="demo-panel ds-span-12"><h3>Status do domínio</h3><p className="demo-caption">Store, Product, Order e Billing comunicados por texto, ícone e tom semântico.</p><div className="demo-row">{(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED', 'PENDING', 'CONFIRMED', 'CANCELLED', 'REVERSED', 'PAID', 'OVERDUE'] as const).map((status) => <DomainStatusBadge status={status} key={status} />)}</div></div>
          </div></section>

          <section className="ds-section"><SectionHeader eyebrow="03 · Semântica ATS" title="Métricas, estados e cabeçalhos" description="Componentes de produto construídos sobre primitives, com linguagem operacional consistente." /><PageHeader eyebrow="Exemplo de página" title="Visão operacional" description="Dados fictícios para validar hierarquia." action={<Button><Layers3 size={16} aria-hidden="true" />Nova visão</Button>} /><div className="ds-grid" style={{ marginTop: '1rem' }}><div className="ds-span-4"><MetricCard label="Itens ativos" value={50} detail="limite demonstrado" /></div><div className="ds-span-4"><MetricCard label="Categorias" value={5} detail="estrutura local" /></div><div className="ds-span-4"><MetricCard label="Temas" value={6} detail="presets disponíveis" /></div></div><div className="ds-grid" style={{ marginTop: '1rem' }}><div className="ds-span-4"><StateBox kind="empty" title="Sem resultados" description="Ajuste os filtros para continuar." /></div><div className="ds-span-4"><StateBox kind="loading" title="Carregando visão" description="A estrutura permanece estável." /></div><div className="ds-span-4"><StateBox kind="error" title="Não foi possível carregar" description="Tente novamente sem perder o contexto." /></div></div></section>

          <section className="ds-section" id="temas"><SectionHeader eyebrow="04 · Store Theme Engine" title="Uma estrutura, seis atmosferas" description="O seletor altera somente tokens permitidos. A composição da vitrine permanece idêntica." /><StoreThemeProvider><StorefrontPreview /></StoreThemeProvider></section>

          <section className="ds-section"><div className="demo-panel"><div className="demo-row" style={{ justifyContent: 'space-between' }}><div><span className="eyebrow"><Palette size={15} aria-hidden="true" /> Licenças verificadas</span><h2 className="text-2xl font-extrabold">Stack visual controlado</h2><p className="demo-caption">Tailwind CSS · shadcn/ui · Radix UI · Motion · Magic UI · Motion Primitives · Lucide</p></div><Badge tone="success"><Check size={13} aria-hidden="true" />Uso comercial compatível</Badge></div></div></section>
        </main>
      </div>
    </MotionConfig>
  )
}
