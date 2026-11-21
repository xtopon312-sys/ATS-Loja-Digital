import type { HTMLAttributes, PropsWithChildren } from 'react'

import { cn } from '../cn'

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <article className={cn('ui-card', className)} {...props}>
      {children}
    </article>
  )
}
