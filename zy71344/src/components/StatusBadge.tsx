import type { ConfirmStatus, ConflictType } from '@/types'
import { statusLabel } from '@/utils'
import { Check, Pencil, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  status: ConfirmStatus
  size?: 'sm' | 'md'
}

const config: Record<ConfirmStatus, { icon: LucideIcon; cls: string }> = {
  confirmed: { icon: Check, cls: 'bg-status-confirmed/20 text-status-confirmed' },
  temporary: { icon: Pencil, cls: 'bg-status-temporary/20 text-status-temporary' },
  conflict: { icon: AlertTriangle, cls: 'bg-status-conflict/20 text-status-conflict' },
}

export function StatusBadge({ status, size = 'sm' }: Props) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  const iconSize = size === 'sm' ? 12 : 14
  const c = config[status]
  const Icon = c.icon

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-mono ${sizeClass} ${c.cls}`}>
      <Icon size={iconSize} />
      {statusLabel(status)}
    </span>
  )
}

export function ConflictBadge({ type }: { type: ConflictType }) {
  const labels: Record<ConflictType, string> = {
    beat_drift: '八拍漂移',
    cut_overlap: '剪辑点重叠',
    note_overwrite: '备注覆盖',
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full text-xs px-2 py-0.5 bg-status-conflict/20 text-status-conflict font-mono">
      <AlertTriangle size={12} />
      {labels[type]}
    </span>
  )
}
