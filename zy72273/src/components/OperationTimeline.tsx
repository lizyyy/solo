import type { OperationLog } from '@/types'
import { Download, Camera, Edit, RefreshCw, FileText, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const actionIcons: Record<string, typeof Download> = {
  import: Download,
  supplement_photo: Camera,
  manual_correct: Edit,
  rerun: RefreshCw,
  update_note: FileText,
}

const actionColors: Record<string, string> = {
  import: 'text-status-blue',
  supplement_photo: 'text-status-green',
  manual_correct: 'text-accent',
  rerun: 'text-status-red',
  update_note: 'text-text-secondary',
}

interface OperationTimelineProps {
  logs: OperationLog[]
}

export default function OperationTimeline({ logs }: OperationTimelineProps) {
  if (logs.length === 0) {
    return <p className="text-sm text-text-secondary py-4">暂无操作记录</p>
  }

  return (
    <div className="space-y-0">
      {logs.map((log, i) => {
        const Icon = actionIcons[log.action] ?? Circle
        const color = actionColors[log.action] ?? 'text-text-secondary'
        const isLast = i === logs.length - 1
        return (
          <div key={log.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-card', color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border" />}
            </div>
            <div className={cn('pb-4 flex-1', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{log.operator}</span>
                <span className="text-xs text-text-secondary">{log.operatorRole}</span>
              </div>
              <p className="text-sm text-text-secondary mt-0.5">{log.description}</p>
              {log.reason && (
                <p className="text-xs text-accent mt-1">原因: {log.reason}</p>
              )}
              <p className="text-xs text-text-secondary mt-1 data-font">{log.timestamp}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
