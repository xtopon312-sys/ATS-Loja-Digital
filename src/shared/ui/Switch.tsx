import * as SwitchPrimitive from '@radix-ui/react-switch'
import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '../cn'

export function Switch({ className, ...props }: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root className={cn('ui-switch', className)} {...props}><SwitchPrimitive.Thumb className="ui-switch__thumb" /></SwitchPrimitive.Root>
}
