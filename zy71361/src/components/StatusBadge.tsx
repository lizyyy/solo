import { cn } from '@/lib/utils'
import type { BorrowStatus } from '@/types'
import { statusLabel } from '@/utils/report'

const statusStyles: Record<BorrowStatus, string> = {
  borrowed: 'bg-[#d4a843]/20 text-[#d4a843] border-[#d4a843]/40',
  returned: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  on_stage: 'bg-[#9b59b6]/20 text-[#9b59b6] border-[#9b59b6]/40',
  pending_review: 'bg-[#f39c12]/20 text-[#f39c12] border-[#f39c12]/40',
}

export function StatusBadge({ status }: { status: BorrowStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        statusStyles[status],
      )}
    >
      {statusLabel(status)}
    </span>
  )
}
