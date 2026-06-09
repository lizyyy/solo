import { useAppStore } from '../../store/useAppStore'
import type { AnomalyType, ImpactLevel, Status } from '../../types'

const statusOptions: { value: Status | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'reviewing', label: '复核中' },
  { value: 'processed', label: '已处理' },
  { value: 'completed', label: '已完成' },
]

const anomalyTypeOptions: { value: AnomalyType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'rename', label: '改名映射' },
  { value: 'old_curve', label: '旧版曲线' },
  { value: 'verbal_mismatch', label: '口头冲突' },
  { value: 'missing_vaccine', label: '疫苗缺失' },
  { value: 'data_conflict', label: '数据冲突' },
]

const impactLevelOptions: { value: ImpactLevel | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '严重' },
]

export default function FilterPanel() {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const statusFilter = useAppStore((s) => s.statusFilter)
  const anomalyTypeFilter = useAppStore((s) => s.anomalyTypeFilter)
  const impactLevelFilter = useAppStore((s) => s.impactLevelFilter)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const setStatusFilter = useAppStore((s) => s.setStatusFilter)
  const setAnomalyTypeFilter = useAppStore((s) => s.setAnomalyTypeFilter)
  const setImpactLevelFilter = useAppStore((s) => s.setImpactLevelFilter)
  const resetFilters = useAppStore((s) => s.resetFilters)

  const chipCls = (active: boolean) => `chip ${active ? 'chip-active' : ''}`

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-clay-400">🐾</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索宠物名或别名..."
            className="w-full pl-10 pr-4 py-2.5 border border-clay-200 rounded-xl bg-paper text-sm focus:outline-none focus:border-clay-400 focus:ring-2 focus:ring-clay-100 transition-all placeholder:text-clay-300"
          />
        </div>
        <button onClick={resetFilters} className="btn-ghost self-start lg:self-center">
          <span>↺</span>
          <span>重置筛选</span>
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-clay-500 font-medium w-16 shrink-0">状态</span>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={chipCls(statusFilter === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-clay-500 font-medium w-16 shrink-0">异常类型</span>
          <div className="flex flex-wrap gap-2">
            {anomalyTypeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAnomalyTypeFilter(opt.value)}
                className={chipCls(anomalyTypeFilter === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-clay-500 font-medium w-16 shrink-0">影响级别</span>
          <div className="flex flex-wrap gap-2">
            {impactLevelOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setImpactLevelFilter(opt.value)}
                className={chipCls(impactLevelFilter === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
