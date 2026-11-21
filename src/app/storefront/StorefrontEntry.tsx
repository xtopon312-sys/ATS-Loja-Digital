import { useEffect, useState } from 'react'
import type { storefrontComposition } from '../storefrontComposition'
import { StateBox } from '../../shared/ui/Semantic'
import { Button } from '../../shared/ui/Button'
import { Storefront } from './Storefront'

export function StorefrontEntry() {
  const [repository, setRepository] = useState<Awaited<ReturnType<typeof storefrontComposition>>>(), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0)
  useEffect(() => { let active = true
    void import('../storefrontComposition').then(module => module.storefrontComposition()).then(repo => { if (active) setRepository(repo) }, () => { if (active) setFailed(true) })
    return () => { active = false }
  }, [retry])
  let slug = ''
  try { slug = decodeURIComponent(window.location.pathname.slice('/loja/'.length)) } catch { /* Invalid encoded slug resolves as not found. */ }
  if (!repository) return <main className="foundation"><StateBox kind={failed ? 'error' : 'loading'} title={failed ? 'Catálogo indisponível' : 'Carregando loja'} description={failed ? 'Não foi possível conectar ao catálogo local.' : 'Aguarde um instante.'} />{failed && <Button onClick={() => { setFailed(false); setRetry(v => v + 1) }}>Tentar novamente</Button>}</main>
  return <Storefront {...repository} slug={slug} />
}
