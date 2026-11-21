import type { HTMLAttributes, PropsWithChildren } from 'react'

import { cn } from '../cn'

type BadgeTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ children, className, tone = 'neutral', ...props }: PropsWithChildren<BadgeProps>) {
  return (
    <span className={cn('ui-badge', `ui-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  )
}
