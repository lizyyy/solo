import type { ComparisonResult } from '@/types'
import { GitCompareArrows, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { SEVERITY_COLORS } from '@/types'

interface ComparisonPanelProps {
  comparison: ComparisonResult
}

const STATUS_CONFIG = {
  normal: { icon: CheckCircle, color: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/20', label: '一致' },
  warning: { icon: AlertTriangle, color: 'text-accent-orange', bg: 'bg-accent-orange/10', border: 'border-accent-orange/20', label: '有差异' },
  error: { icon: XCircle, color: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/20', label: '异常' },
}

export default function ComparisonPanel({ comparison }: ComparisonPanelProps) {
  const config = STATUS_CONFIG[comparison.overallStatus]
  const StatusIcon = config.icon

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent-blue/15 flex items-center justify-center">
          <GitCompareArrows className="w-3.5 h-3.5 text-accent-blue" />
        </div>
        <h3 className="text-sm font-medium text-surface-200">比对面板</h3>
        <span className={`px-2 py-0.5 rounded-full ${config.bg} ${config.color} text-[10px] font-medium`}>
          {config.label}
        </span>
      </div>

      <div className={`rounded-lg ${config.bg} border ${config.border} px-3 py-2.5 mb-4`}>
        <div className="flex items-start gap-2">
          <StatusIcon className={`w-4 h-4 ${config.color} mt-0.5 flex-shrink-0`} />
          <p className="text-xs text-surface-200 leading-relaxed">{comparison.summary}</p>
        </div>
      </div>

      {comparison.differences.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-8 h-8 text-accent-green mx-auto mb-2" />
          <p className="text-sm text-surface-300">四端数据一致，无差异项</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comparison.differences.map((diff, index) => (
            <div
              key={index}
              className="bg-surface-700/40 border border-surface-600 rounded-lg overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-600">
                <Info className="w-3.5 h-3.5" style={{ color: SEVERITY_COLORS[diff.severity] }} />
                <span className="text-xs text-surface-200 font-medium">{diff.field}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded ml-auto"
                  style={{
                    background: `${SEVERITY_COLORS[diff.severity]}15`,
                    color: SEVERITY_COLORS[diff.severity],
                  }}
                >
                  {diff.severity === 'error' ? '异常' : diff.severity === 'warning' ? '警告' : '提示'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <div className="px-3 py-2 border-r border-surface-600">
                  <p className="text-[10px] text-surface-400 mb-0.5">预期值</p>
                  <p className="text-xs text-accent-green font-mono">{diff.expected}</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[10px] text-surface-400 mb-0.5">实际值</p>
                  <p className="text-xs text-accent-red font-mono">{diff.actual}</p>
                </div>
              </div>
              <div className="px-3 py-2 bg-surface-700/60 border-t border-surface-600">
                <p className="text-[11px] text-surface-300 leading-relaxed">{diff.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
