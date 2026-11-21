import { lazy, Suspense, useState } from 'react'

import { Badge } from '../shared/ui/Badge'
import { Button } from '../shared/ui/Button'
import { Card } from '../shared/ui/Card'

const DesignSystemPage = lazy(async () => {
  const module = await import('./DesignSystemPage')
  return { default: module.DesignSystemPage }
})
const MerchantEntry = lazy(() => import('./merchant/MerchantEntry').then(module => ({ default: module.MerchantEntry })))
const StorefrontEntry = lazy(() => import('./storefront/StorefrontEntry').then(module => ({ default: module.StorefrontEntry })))

export function App() {
  const [verified, setVerified] = useState(false)
  if (window.location.pathname.startsWith('/loja/')) return <Suspense fallback={<main className="foundation">Carregando loja…</main>}><StorefrontEntry /></Suspense>

  if (['/login', '/acesso-negado', '/master', '/painel'].some(path => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`))) return <Suspense fallback={<main className="foundation">Carregando painel…</main>}><MerchantEntry /></Suspense>

  if (window.location.pathname === '/design-system') return <Suspense fallback={<main className="foundation"><Card><p>Carregando Design System…</p></Card></main>}><DesignSystemPage /></Suspense>

  return (
    <main className="foundation">
      <Card>
        <Badge>Fundação técnica</Badge>
        <h1>ATS Loja Digital</h1>
        <p>Base independente preparada para desenvolvimento por fases.</p>
        <Button onClick={() => setVerified(true)}>Verificar interface</Button>
        <p><a href="/design-system">Abrir Design System ATS 2.0</a></p>
        <p><a href="/login">Acessar Painel do Lojista</a></p>
        <p className="foundation-status" role="status">
          {verified ? 'Interface respondendo.' : 'Aguardando verificação.'}
        </p>
      </Card>
    </main>
  )
}
