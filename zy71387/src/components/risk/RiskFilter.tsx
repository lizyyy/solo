import { Shield, AlertCircle, AlertTriangle, AlertOctagon } from 'lucide-react'
import type { RiskSeverity, RiskItemStatus } from '@/types'
import { useRiskStore } from '@/store/useRiskStore'

const severityOptions: { value: RiskSeverity | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'high', label: '高危' },
  { value: 'medium', label: '中危' },
  { value: 'low', label: '低危' },
]

const statusOptions: { value: RiskItemStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'confirmed', label: '已确认' },
  { value: 'ignored', label: '已忽略' },
]

export default function RiskFilter() {
  const stats = useRiskStore((s) => s.stats)
  const filterSeverity = useRiskStore((s) => s.filterSeverity)
  const filterStatus = useRiskStore((s) => s.filterStatus)
  const setFilterSeverity = useRiskStore((s) => s.setFilterSeverity)
  const setFilterStatus = useRiskStore((s) => s.setFilterStatus)

  return (
    <div className="bg-base-800 border border-base-600 rounded-lg p-4 mb-4">
      <div className="flex gap-3 mb-4">
        <div className="flex items-center gap-2 bg-base-700 rounded px-3 py-2">
          <Shield size={14} className="text-muted" />
          <span className="text-muted text-xs">总数</span>
          <span className="text-white text-sm font-medium">{stats.total}</span>
        </div>
        <div className="flex items-center gap-2 bg-base-700 rounded px-3 py-2">
          <AlertCircle size={14} className="text-warn" />
          <span className="text-muted text-xs">待处理</span>
          <span className="text-warn text-sm font-medium">{stats.pending}</span>
        </div>
        <div className="flex items-center gap-2 bg-base-700 rounded px-3 py-2">
          <AlertTriangle size={14} className="text-danger" />
          <span className="text-muted text-xs">高危</span>
          <span className="text-danger text-sm font-medium">{stats.high}</span>
        </div>
        <div className="flex items-center gap-2 bg-base-700 rounded px-3 py-2">
          <AlertOctagon size={14} className="text-warn" />
          <span className="text-muted text-xs">中危</span>
          <span className="text-warn text-sm font-medium">{stats.medium}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-muted text-sm whitespace-nowrap">严重程度:</span>
        <div className="flex rounded overflow-hidden">
          {severityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterSeverity(opt.value)}
              className={`px-3 py-1 text-sm transition-colors ${
                filterSeverity === opt.value
                  ? 'bg-accent text-base-900 font-bold'
                  : 'bg-base-600 text-muted hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-muted text-sm whitespace-nowrap">状态:</span>
        <div className="flex rounded overflow-hidden">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-1 text-sm transition-colors ${
                filterStatus === opt.value
                  ? 'bg-accent text-base-900 font-bold'
                  : 'bg-base-600 text-muted hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
