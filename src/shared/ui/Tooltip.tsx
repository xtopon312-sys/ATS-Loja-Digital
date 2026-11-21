import * as TooltipPrimitive from '@radix-ui/react-tooltip'

export function TooltipProvider(props: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) { return <TooltipPrimitive.Provider {...props} /> }
export function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return <TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content className="ui-tooltip" sideOffset={6}>{label}</TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root>
}
