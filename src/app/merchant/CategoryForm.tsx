import { useState, type FormEvent } from 'react'
import { Button } from '../../shared/ui/Button'
import { Input } from '../../shared/ui/FormControls'
import { feedback } from '../../modules/merchant/application/feedback'

export function CategoryForm({ initialName = '', disabled, onSave, onCancel }: { initialName?: string; disabled?: boolean; onSave(name: string): Promise<void>; onCancel?(): void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = event.currentTarget, data = new FormData(form)
    try { await onSave(String(data.get('name'))); if (!initialName) form.reset() }
    catch (cause) { setError(feedback(cause)) } finally { setBusy(false) }
  }
  return <form onSubmit={event => { void submit(event) }} className="category-form" aria-busy={busy}>
    <Input name="name" label="Nome da categoria" required maxLength={120} defaultValue={initialName} disabled={disabled || busy} aria-invalid={!!error} aria-describedby={error ? 'category-error' : undefined} />
    {error && <p id="category-error" role="alert" className="form-error">{error}</p>}
    <div className="form-actions">{onCancel && <Button variant="secondary" disabled={busy} onClick={onCancel}>Cancelar edição</Button>}<Button type="submit" disabled={disabled} loading={busy} loadingLabel="Salvando…">{initialName ? 'Salvar categoria' : 'Criar categoria'}</Button></div>
  </form>
}
