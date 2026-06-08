import { useStore } from '@/store/useStore'
import { formatTimestamp, statusLabel, sourceTypeLabel, checkTypeLabel } from '@/utils/helpers'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'

const statusIcon = {
  passed: CheckCircle2,
  needs_review: AlertTriangle,
  legacy_amended: AlertTriangle,
}

const statusColor = {
  passed: 'text-green-400',
  needs_review: 'text-yellow-400',
  legacy_amended: 'text-blue-400',
}

const statusBg = {
  passed: 'bg-green-500/10',
  needs_review: 'bg-yellow-500/10',
  legacy_amended: 'bg-blue-500/10',
}

export default function ValidationTable() {
  const records = useStore((s) => s.records)
  const validationResults = useStore((s) => s.validationResults)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <AlertTriangle className="mb-3 h-8 w-8" />
        <p className="text-sm">暂无数据，请先录入实验记录</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map((record) => {
        const vr = validationResults.find((v) => v.recordId === record.id)
        const expanded = expandedId === record.id
        const Icon = statusIcon[record.status]
        const failedChecks = vr?.checks.filter((c) => !c.passed) || []

        return (
          <div
            key={record.id}
            className={`rounded-lg border transition-all ${
              record.status === 'needs_review'
                ? 'border-yellow-500/30 bg-yellow-500/5'
                : record.status === 'legacy_amended'
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : 'border-slate-700/50 bg-slate-800/50'
            }`}
          >
            <div
              className="flex cursor-pointer items-center gap-3 px-4 py-3"
              onClick={() => setExpandedId(expanded ? null : record.id)}
            >
              <Icon
                className={`h-4 w-4 flex-shrink-0 ${statusColor[record.status]}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-300">
                    {formatTimestamp(record.timestamp)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBg[record.status]} ${statusColor[record.status]}`}
                  >
                    {statusLabel(record.status)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  力={record.force.toFixed(1)}{record.forceUnit} · 位移=
                  {record.displacement.toFixed(1)}{record.displacementUnit} · 来源=
                  {sourceTypeLabel(record.source.type)}
                  {failedChecks.length > 0 && (
                    <span className="ml-2 text-yellow-400">
                      {failedChecks.length}项异常
                    </span>
                  )}
                </div>
              </div>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </div>

            {expanded && vr && (
              <div className="border-t border-slate-700/30 px-4 py-3">
                <div className="grid gap-2">
                  {vr.checks.map((check, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                        check.passed
                          ? 'bg-slate-800/80 text-slate-400'
                          : 'bg-slate-900/80 text-yellow-300'
                      }`}
                    >
                      {check.passed ? (
                        <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500" />
                      ) : (
                        <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-yellow-500" />
                      )}
                      <div>
                        <div className="font-medium">
                          [{checkTypeLabel(check.type)}] {check.message}
                        </div>
                        {check.suggestion && (
                          <div className="mt-0.5 text-slate-500">
                            💡 {check.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
