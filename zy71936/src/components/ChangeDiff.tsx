import type { ChangeLog } from '@/lib/types'
import { FIELD_LABELS } from '@/lib/types'
import { ArrowRight, User, Clock, MessageSquare } from 'lucide-react'

interface ChangeDiffProps {
  log: ChangeLog
}

export default function ChangeDiff({ log }: ChangeDiffProps) {
  const fieldLabel = FIELD_LABELS[log.field] ?? log.field
  const formattedDate = new Date(log.changedAt).toLocaleString('zh-CN')

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-[#1e1e38] p-4">
      <div className="mb-2 text-sm font-medium text-zinc-300">{fieldLabel}</div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="rounded bg-red-900/40 px-2 py-0.5 text-red-400 line-through">
          {log.oldValue}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-emerald-400">
          {log.newValue}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {log.changedBy}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formattedDate}
        </span>
        {log.changeReason && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {log.changeReason}
          </span>
        )}
      </div>
    </div>
  )
}
