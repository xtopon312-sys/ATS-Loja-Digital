import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import logo from '../../assets/ats-logo.png'
import type { AuthService } from '../../modules/auth/application/AuthService'
import { feedback } from '../../modules/merchant/application/feedback'
import { Button } from '../../shared/ui/Button'
import { Input } from '../../shared/ui/FormControls'

export function Login({ auth }: { auth: AuthService }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true)
    const data = new FormData(event.currentTarget)
    try { await auth.signIn(String(data.get('email')).trim(), String(data.get('password'))) }
    catch (cause) { setError(feedback(cause)) }
    finally { setBusy(false) }
  }
  return <main className="merchant-login"><section className="login-story"><a href="/" className="merchant-brand"><img src={logo} alt="ATS" /><span>Loja Digital</span></a><span className="eyebrow">Seu negócio, bem organizado</span><h1>Mais controle.<br />Mais espaço para crescer.</h1><p>Produtos e categorias em um só lugar. Uma operação simples, com a identidade da sua loja.</p><span className="login-local">Ambiente local · Firebase Emulator</span></section>
    <section className="login-card" aria-labelledby="login-title"><LockKeyhole size={26} aria-hidden="true" /><h2 id="login-title">Acesse sua loja</h2><p>Entre com sua conta administrativa.</p><form onSubmit={event => { void submit(event) }} aria-busy={busy}>
      <Input name="email" type="email" autoComplete="username" label="E-mail" required disabled={busy} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
      <Input name="password" type="password" autoComplete="current-password" label="Senha" required disabled={busy} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
      {error && <p id="login-error" className="form-error" role="alert">{error}</p>}
      <Button type="submit" loading={busy} loadingLabel="Entrando…">Entrar no painel <ArrowRight size={17} aria-hidden="true" /></Button>
    </form><small>O acesso é exclusivo para contas provisionadas neste ambiente.</small></section>
  </main>
}
