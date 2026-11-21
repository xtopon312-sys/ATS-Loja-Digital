import { useEffect, useState } from 'react'
import type { merchantComposition } from '../merchantComposition'
import { MerchantApp } from './MerchantApp'
import { StateBox } from '../../shared/ui/Semantic'
import { Button } from '../../shared/ui/Button'

export function MerchantEntry() {
  const [services, setServices] = useState<Awaited<ReturnType<typeof merchantComposition>>>(), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    void import('../merchantComposition').then(module => module.merchantComposition()).then(value => { if (live) { setServices(value); setFailed(false) } }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [attempt])
  if (services) return <MerchantApp {...services} />
  return <main className="foundation"><StateBox kind={failed ? 'error' : 'loading'} title={failed ? 'Ambiente local indisponível' : 'Preparando seu acesso'} description={failed ? 'Inicie os Emulators e a aplicação com a configuração local documentada no README.' : 'Conectando ao ambiente local.'} />{failed && <Button onClick={() => setAttempt(v => v + 1)}>Tentar novamente</Button>}</main>
}
