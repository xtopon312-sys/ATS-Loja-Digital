import { AlertTriangle, Box, CircleCheck, CircleX, PackageOpen, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../cn'
import { AnimatedNumber } from '../motion/AnimatedNumber'
import { Badge } from './Badge'
import { Card } from './Card'
import { Skeleton } from './Skeleton'

type Status = 'active' | 'pending' | 'warning' | 'error' | 'neutral'
const statusMeta = {
  active: { label: 'Ativo', tone: 'success', Icon: CircleCheck },
  pending: { label: 'Pendente', tone: 'info', Icon: TrendingUp },
  warning: { label: 'Atenção', tone: 'warning', Icon: AlertTriangle },
  error: { label: 'Erro', tone: 'danger', Icon: CircleX },
  neutral: { label: 'Neutro', tone: 'neutral', Icon: Box },
} as const

export function StatusBadge({ status }: { status: Status }) {
  const { label, tone, Icon } = statusMeta[status]
  return <Badge className="status-badge" tone={tone}><Icon size={13} aria-hidden="true" />{label}</Badge>
}

type DomainStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'ARCHIVED' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REVERSED' | 'PAID' | 'OVERDUE'
const domainStatusMap: Record<DomainStatus, Status> = {
  ACTIVE: 'active', SUSPENDED: 'error', INACTIVE: 'neutral', ARCHIVED: 'neutral',
  PENDING: 'pending', CONFIRMED: 'active', CANCELLED: 'error', REVERSED: 'warning',
  PAID: 'active', OVERDUE: 'error',
}

export function DomainStatusBadge({ status, label }: { status: DomainStatus; label?: string }) {
  const meta = statusMeta[domainStatusMap[status]]
  const Icon = meta.Icon
  return <Badge className="status-badge" tone={meta.tone}><Icon size={13} aria-hidden="true" />{label ?? status}</Badge>
}

export function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <Card className="metric-card" aria-label={`${label}: ${value}`}><div className="metric-card__head"><span>{label}</span><TrendingUp size={18} aria-hidden="true" /></div><strong className="metric-card__value"><AnimatedNumber value={value} /></strong><Badge tone="brand">{detail}</Badge></Card>
}

export function StateBox({ kind, title, description }: { kind: 'empty' | 'loading' | 'error'; title: string; description: string }) {
  const Icon = kind === 'empty' ? PackageOpen : kind === 'error' ? CircleX : Box
  return <div className="state-box" role={kind === 'error' ? 'alert' : 'status'}><div><Icon size={28} aria-hidden="true" /><h3>{title}</h3><p>{description}</p>{kind === 'loading' && <div style={{ display: 'grid', gap: '.5rem', marginTop: '1rem' }}><Skeleton style={{ width: '12rem' }} /><Skeleton style={{ width: '8rem' }} /></div>}</div></div>
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h3>{title}</h3><p>{description}</p></div>{action}</header>
}

export function ResponsivePage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-10', className)}>{children}</div>
}
