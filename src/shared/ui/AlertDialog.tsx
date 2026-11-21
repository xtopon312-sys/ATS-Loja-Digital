import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'

/** Confirmation on the installed Radix primitive, with least-destructive initial focus. */
export function AlertDialog({ trigger, title, description, onConfirm, errorMessage, confirmLabel = 'Arquivar' }: { trigger: ReactNode; confirmLabel?: string; title: string; description: string; errorMessage?: string; onConfirm(): Promise<boolean> }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  async function confirm() {
    setBusy(true); setFailed(false)
    try { if (await onConfirm()) setOpen(false); else setFailed(true) } finally { setBusy(false) }
  }
  return <DialogPrimitive.Root open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
    <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
    <DialogPrimitive.Portal><DialogPrimitive.Overlay className="ui-overlay" />
      <DialogPrimitive.Content className="ui-dialog" role="alertdialog" onOpenAutoFocus={event => { event.preventDefault(); cancel.current?.focus() }} onPointerDownOutside={event => event.preventDefault()}>
        <DialogPrimitive.Title>{title}</DialogPrimitive.Title><DialogPrimitive.Description>{description}</DialogPrimitive.Description>
        {failed && <p role="alert" className="form-error">{errorMessage || 'Não foi possível concluir a operação. Confira as restrições informadas e tente novamente.'}</p>}
        <div className="ui-dialog-actions"><button ref={cancel} type="button" className="ui-button ui-button--secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button><Button variant="destructive" loading={busy} onClick={() => { void confirm() }}>{confirmLabel}</Button></div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
}
