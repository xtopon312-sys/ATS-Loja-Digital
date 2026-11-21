import { CircleCheck } from 'lucide-react'
import type { HTMLAttributes } from 'react'

export function Toast({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className="ui-toast" role="status" {...props}><CircleCheck size={20} aria-hidden="true" /> <div>{children}</div></div>
}
