import { useCraneStore } from '@/store'
import { ScrollText, Clock } from 'lucide-react'

export default function AuditLog() {
  const auditLog = useCraneStore(s => s.auditLog)
  const records = useCraneStore(s => s.records)

  if (auditLog.length === 0) return null

  const sorted = [...auditLog].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="harbor-panel p-4">
      <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2 mb-3">
        <ScrollText className="w-4 h-4" />
        判断过程审计日志
        <span className="text-xs text-gray-500 font-mono ml-auto">{auditLog.length} 条</span>
      </h3>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {sorted.map(entry => {
          const record = records.find(r => r.id === entry.recordId)
          const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN')
          const actionColor = entry.action.includes('通过')
            ? 'text-harbor-green' : entry.action.includes('确认')
            ? 'text-harbor-yellow' : entry.action.includes('补录')
            ? 'text-blue-400' : 'text-harbor-red'

          return (
            <div key={entry.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-harbor-border/50 last:border-0">
              <Clock className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
              <span className="font-mono text-gray-500 shrink-0">{time}</span>
              <span className={`font-medium ${actionColor} shrink-0`}>{entry.action}</span>
              <span className="text-gray-400 font-mono shrink-0">
                {record ? record.id.slice(0, 12) : entry.recordId.slice(0, 12)}
              </span>
              <span className="text-gray-500 truncate" title={entry.detail}>{entry.detail}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
