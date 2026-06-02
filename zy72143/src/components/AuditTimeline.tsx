import type { AuditLog } from '@/types'
import { cn } from '@/lib/utils'

const actionDotConfig: Record<string, string> = {
  clean: 'bg-sky-500',
  status_change: 'bg-amber-500',
  operator_note: 'bg-emerald-500',
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface AuditTimelineProps {
  logs: AuditLog[]
  className?: string
}

export default function AuditTimeline({ logs, className }: AuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className={cn('py-8 text-center text-sm text-slate-500', className)}>
        暂无操作记录
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      {logs.map((log, idx) => {
        const dotColor = actionDotConfig[log.action] || 'bg-slate-500'
        const isLast = idx === logs.length - 1

        return (
          <div key={log.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotColor)} />
              {!isLast && <div className="w-px flex-1 bg-slate-700" />}
            </div>
            <div className={cn('pb-6', isLast && 'pb-0')}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-500">{formatTimestamp(log.created_at)}</span>
                <span className="text-sm font-medium text-slate-300">{log.action}</span>
                {log.operator && (
                  <span className="text-xs text-slate-500">by {log.operator}</span>
                )}
              </div>
              {log.old_value && log.new_value && (
                <div className="mt-1 text-xs text-slate-400">
                  <span className="text-red-400/80 line-through">{log.old_value}</span>
                  <span className="mx-1.5 text-slate-600">→</span>
                  <span className="text-emerald-400/80">{log.new_value}</span>
                </div>
              )}
              {log.detail && (
                <p className="mt-1 text-xs text-slate-400">{log.detail}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
