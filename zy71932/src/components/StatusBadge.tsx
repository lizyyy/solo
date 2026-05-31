import type { RecordStatus } from '@/types'

export function StatusBadge({ status }: { status: RecordStatus }) {
  const map: Record<RecordStatus, { label: string; cls: string }> = {
    confirmed: { label: '已确认', cls: 'badge-confirmed' },
    pending: { label: '待确认', cls: 'badge-pending' },
    expired: { label: '已过期', cls: 'badge-expired' },
    conflict: { label: '冲突', cls: 'badge-conflict' },
  }
  const { label, cls } = map[status]
  return <span className={cls}>{label}</span>
}

export function StatusDot({ status }: { status: RecordStatus }) {
  const map: Record<RecordStatus, string> = {
    confirmed: 'bg-confirm',
    pending: 'bg-amber',
    expired: 'bg-danger',
    conflict: 'bg-purple-400',
  }
  return <span className={`status-dot ${map[status]}`} />
}
