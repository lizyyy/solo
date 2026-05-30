import { useMemo } from 'react'
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { AuditEntry } from '../../utils/types'

const ACTION_CONFIG: Record<
  string,
  { Icon: typeof CheckCircle; color: string }
> = {
  confirm: { Icon: CheckCircle, color: '#22c55e' },
  reject: { Icon: XCircle, color: '#ef4444' },
  note: { Icon: MessageSquare, color: '#3b82f6' },
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

export default function AuditLog() {
  const anomalies = useStore((s) => s.anomalies)

  const entries = useMemo(() => {
    const all: (AuditEntry & { anomalyId: string })[] = []
    for (const a of anomalies) {
      for (const entry of a.auditLog) {
        all.push({ ...entry, anomalyId: a.id })
      }
    }
    return all.sort((a, b) => b.timestamp - a.timestamp)
  }, [anomalies])

  return (
    <div className="relative pl-5 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gray-700" />
      <div className="space-y-3">
        {entries.map((entry, i) => {
          const cfg = ACTION_CONFIG[entry.action]
          return (
            <div key={`${entry.anomalyId}-${entry.timestamp}-${i}`} className="relative">
              <div className="absolute -left-5 top-1 h-3 w-3 rounded-full border-2 border-gray-700 bg-[#0a0e1a]" />
              <div className="flex items-start gap-2">
                <cfg.Icon
                  className="h-3.5 w-3.5 mt-0.5 shrink-0"
                  style={{ color: cfg.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-mono">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span className="text-[10px] text-gray-400">{entry.operator}</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">{entry.detail}</p>
                </div>
              </div>
            </div>
          )
        })}
        {entries.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-500">暂无审计日志</div>
        )}
      </div>
    </div>
  )
}
