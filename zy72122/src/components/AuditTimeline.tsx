import { useStore } from '@/store/useStore'
import {
  formatTimestamp,
  actionLabel,
  sourceTypeLabel,
  statusLabel,
} from '@/utils/helpers'
import {
  Circle,
  Plus,
  ShieldCheck,
  MessageSquare,
  FileEdit,
  FilePlus,
} from 'lucide-react'

const actionIcons = {
  created: Plus,
  validated: ShieldCheck,
  reviewed: MessageSquare,
  amended: FileEdit,
  appended: FilePlus,
}

export default function AuditTimeline() {
  const records = useStore((s) => s.records)
  const auditLog = useStore((s) => s.auditLog)

  const sorted = [...auditLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Circle className="mb-3 h-8 w-8" />
        <p className="text-sm">暂无审计记录</p>
      </div>
    )
  }

  return (
    <div className="relative space-y-0">
      {sorted.map((entry, idx) => {
        const record = records.find((r) => r.id === entry.recordId)
        const Icon = actionIcons[entry.action] || Circle
        const isFirst = idx === 0

        return (
          <div key={entry.id} className="relative flex gap-4 pb-6">
            <div className="flex flex-col items-center">
              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
                  entry.action === 'reviewed'
                    ? 'bg-green-500/20 text-green-400'
                    : entry.action === 'validated'
                      ? 'bg-blue-500/20 text-blue-400'
                      : entry.action === 'amended'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-slate-700 text-slate-400'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isFirst && (
                <div className="h-full w-px bg-slate-700/50" />
              )}
            </div>

            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">
                  {actionLabel(entry.action)}
                </span>
                <span className="text-[10px] text-slate-600">
                  {formatTimestamp(entry.timestamp)}
                </span>
                {entry.operator && (
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {entry.operator}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-slate-400">{entry.details}</p>

              {record && (
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-600">
                  <span>记录 #{entry.recordId.slice(-8)}</span>
                  <span>·</span>
                  <span>
                    来源：{sourceTypeLabel(record.source.type)} -{' '}
                    {record.source.reference}
                  </span>
                  {entry.previousStatus && entry.newStatus && (
                    <>
                      <span>·</span>
                      <span>
                        {statusLabel(entry.previousStatus)} →{' '}
                        {statusLabel(entry.newStatus)}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
