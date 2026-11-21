import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from './Button'

interface DialogProps {
  trigger: ReactNode
  title: string
  description: string
  children?: ReactNode
}

export function Dialog({ trigger, title, description, children }: DialogProps) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-overlay" />
        <DialogPrimitive.Content className="ui-dialog">
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
          {children}
          <div className="ui-dialog-actions"><DialogPrimitive.Close asChild><Button variant="secondary">Fechar diálogo</Button></DialogPrimitive.Close></div>
          <DialogPrimitive.Close className="ui-icon-button" aria-label="Fechar" style={{ position: 'absolute', right: '1rem', top: '1rem' }}><X size={18} aria-hidden="true" /></DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
