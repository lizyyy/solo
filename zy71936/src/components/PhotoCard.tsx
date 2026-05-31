import { cn } from '@/lib/utils'
import type { PhotoRecord, MarkStatus } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'
import { FileText } from 'lucide-react'

const BORDER_COLORS: Record<MarkStatus, string> = {
  授权过期: 'border-l-amber-500',
  待复核: 'border-l-sky-500',
  已确认: 'border-l-emerald-500',
  待判断: 'border-l-zinc-500',
}

interface PhotoCardProps {
  record: PhotoRecord
  onClick: () => void
}

export default function PhotoCard({ record, onClick }: PhotoCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg border-l-4 bg-[#1e1e38] p-4 transition-shadow hover:shadow-lg',
        BORDER_COLORS[record.markStatus],
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
        <span className="truncate text-sm font-medium text-zinc-100">
          {record.fileName}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
          {record.sourceType}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs',
            record.authorizationStatus === '有效'
              ? 'bg-emerald-900/60 text-emerald-400'
              : record.authorizationStatus === '过期'
                ? 'bg-amber-900/60 text-amber-400'
                : 'bg-zinc-700 text-zinc-300',
          )}
        >
          {record.authorizationStatus}
        </span>
        <StatusBadge status={record.markStatus} />
      </div>

      {record.markReason && (
        <p className="mb-1 truncate text-xs text-zinc-400">
          {record.markReason}
        </p>
      )}

      {record.nextStep && (
        <p className="text-xs text-zinc-500">{record.nextStep}</p>
      )}
    </div>
  )
}
