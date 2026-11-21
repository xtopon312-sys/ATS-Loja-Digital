import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../cn'

const buttonVariants = cva('ui-button', {
  variants: { variant: { primary: 'ui-button--primary', secondary: 'ui-button--secondary', ghost: 'ui-button--ghost', destructive: 'ui-button--destructive', whatsapp: 'ui-button--whatsapp' } },
  defaultVariants: { variant: 'primary' },
})

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  loadingLabel?: string
}

export function Button({
  children,
  className,
  disabled,
  loading = false,
  loadingLabel = 'Carregando…',
  type = 'button',
  variant = 'primary',
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cn(buttonVariants({ variant }), className)}
      disabled={disabled || loading}
      type={type}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <><span aria-hidden="true" className="ui-button__spinner" />{loadingLabel}</> : children}
    </button>
  )
}
