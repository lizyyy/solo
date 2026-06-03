import { useState } from 'react'
import { ChevronDown, ChevronUp, Upload, ArrowLeftRight, Shield, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuditLog } from '@/lib/api'

interface TimelineProps {
  logs: AuditLog[]
}

const actionConfig: Record<string, { label: string; color: string; icon: typeof Upload }> = {
  batch_created: { label: '批次创建', color: 'bg-blue-500', icon: Upload },
  record_imported: { label: '记录导入', color: 'bg-blue-500', icon: Upload },
  comparison_triggered: { label: '比对触发', color: 'bg-teal-500', icon: ArrowLeftRight },
  discrepancy_detected: { label: '差异检出', color: 'bg-teal-500', icon: ArrowLeftRight },
  conflict_detected: { label: '冲突检出', color: 'bg-[var(--color-amber)]', icon: Shield },
  conflict_resolved: { label: '冲突裁决', color: 'bg-[var(--color-amber)]', icon: Shield },
  old_caliber_detected: { label: '旧口径检出', color: 'bg-teal-500', icon: ArrowLeftRight },
  tax_remark_reviewed: { label: '备注补录', color: 'bg-green-500', icon: CheckCircle },
  replay_executed: { label: '复盘执行', color: 'bg-green-500', icon: CheckCircle },
  replay_import_started: { label: '复盘导入', color: 'bg-blue-500', icon: Upload },
  replay_compare_started: { label: '复盘比对', color: 'bg-teal-500', icon: ArrowLeftRight },
}

const defaultConfig = { label: '操作', color: 'bg-gray-400', icon: CheckCircle }

export default function Timeline({ logs }: TimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  if (logs.length === 0) {
    return <div className="py-12 text-center text-sm text-gray-400">暂无操作记录</div>
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />
      <div className="flex flex-col gap-4">
        {logs.map(log => {
          const cfg = actionConfig[log.action] || defaultConfig
          const Icon = cfg.icon
          const isExpanded = expanded.has(log.id)
          return (
            <div key={log.id} className="relative flex gap-4">
              <div className={cn('absolute left-[-20px] top-1 flex h-5 w-5 items-center justify-center rounded-full', cfg.color)}>
                <Icon className="h-3 w-3 text-white" />
              </div>
              <div className="flex-1 rounded-lg border bg-white p-3">
                <div
                  className="flex cursor-pointer items-center justify-between"
                  onClick={() => toggle(log.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{cfg.label}</span>
                    <span className="text-xs text-gray-400">{log.actor}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {log.role === 'fund_accountant' ? '基金会计' : '结算主管'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">{formatTime(log.timestamp)}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </div>
                {isExpanded && log.detail && (
                  <div className="mt-2 rounded bg-gray-50 p-3">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                      {JSON.stringify(log.detail, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
