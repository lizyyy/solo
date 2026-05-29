import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { DetectionReport } from '../../shared/types'

interface Props {
  reports: DetectionReport[]
}

export default function ReportHistory({ reports }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-brand-800 rounded-lg border border-brand-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-brand-200 hover:text-white transition-colors"
      >
        <span>历史报告 ({reports.length})</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="border-t border-brand-700 max-h-64 overflow-y-auto">
          {reports.length === 0 ? (
            <p className="text-xs text-brand-400 px-4 py-3">暂无保存的报告</p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="px-4 py-3 border-b border-brand-700/50 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-100">{r.name}</span>
                  <span className="mono text-xs text-brand-400">{new Date(r.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-brand-300">
                  <span className="text-red-400">冲突: {r.conflictCount}</span>
                  <span className="text-orange-400">风险: {r.adjacencyRiskCount}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
