import { Filter, RotateCcw, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useState } from 'react'
import { useAnomalyStore } from '@/hooks/useAnomalyStore'
import { cn } from '@/lib/utils'
import { ANOMALY_TYPE_LABELS, STATUS_LABELS } from '@/utils/types'
import type { AnomalyType, RecordStatus } from '@/utils/types'

const BUOY_IDS = ['BY-001', 'BY-002', 'BY-003', 'BY-004', 'BY-005']

export default function FilterPanel() {
  const { filter, setFilter, resetFilter } = useAnomalyStore()
  const [isExpanded, setIsExpanded] = useState(true)

  const hasActiveFilter =
    filter.buoyId || filter.anomalyType || filter.status || filter.dateFrom || filter.dateTo

  return (
    <div className="bg-ocean-800/50 backdrop-blur-sm rounded-xl border border-ocean-700 mb-6 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-ocean-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neon/10">
            <Filter className="w-4 h-4 text-neon" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-surface font-display">筛选口径</h3>
            <p className="text-xs text-muted">
              {hasActiveFilter ? '已设置筛选条件' : '点击展开设置筛选条件'}
            </p>
          </div>
          {hasActiveFilter && (
            <span className="px-2 py-0.5 rounded-full bg-neon/20 text-neon text-xs font-medium">
              已启用
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 border-t border-ocean-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">浮标编号</label>
              <select
                value={filter.buoyId}
                onChange={(e) => setFilter({ buoyId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-700 text-surface text-sm focus:outline-none focus:border-neon/50 transition-colors"
              >
                <option value="">全部浮标</option>
                {BUOY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">异常类型</label>
              <select
                value={filter.anomalyType}
                onChange={(e) => setFilter({ anomalyType: e.target.value as AnomalyType | '' })}
                className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-700 text-surface text-sm focus:outline-none focus:border-neon/50 transition-colors"
              >
                <option value="">全部类型</option>
                {Object.entries(ANOMALY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">确认状态</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ status: e.target.value as RecordStatus | '' })}
                className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-700 text-surface text-sm focus:outline-none focus:border-neon/50 transition-colors"
              >
                <option value="">全部状态</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">开始日期</label>
              <input
                type="date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ dateFrom: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-700 text-surface text-sm focus:outline-none focus:border-neon/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">结束日期</label>
              <input
                type="date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ dateTo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-700 text-surface text-sm focus:outline-none focus:border-neon/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-ocean-700">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={filter.applyToExport}
                  onChange={(e) => setFilter({ applyToExport: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full bg-ocean-700 peer-checked:bg-neon transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4"></div>
              </div>
              <div className="flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-muted group-hover:text-surface transition-colors" />
                <span className="text-sm text-muted group-hover:text-surface transition-colors">
                  应用到导出
                </span>
              </div>
            </label>

            <button
              onClick={resetFilter}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all',
                hasActiveFilter
                  ? 'text-alert hover:bg-alert/10'
                  : 'text-muted hover:text-surface hover:bg-ocean-700/50'
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置筛选
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
