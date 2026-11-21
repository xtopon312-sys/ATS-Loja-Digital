import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode, ComponentPropsWithoutRef } from 'react'

interface DrawerProps { trigger: ReactNode; title: string; description: string; children?: ReactNode; open?: boolean; onOpenChange?(open: boolean): void; contentProps?: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> }

export function Drawer({ trigger, title, description, children, open, onOpenChange, contentProps }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-overlay" />
        <DialogPrimitive.Content className="ui-drawer" {...contentProps}>
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close className="ui-icon-button" aria-label="Fechar painel" style={{ position: 'absolute', right: '1rem', top: '1rem' }}><X size={18} aria-hidden="true" /></DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
