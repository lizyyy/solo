import { pets } from '../../data/mockPets'
import { anomalies } from '../../data/mockAnomalies'
import { useAppStore } from '../../store/useAppStore'
import type { Status, AnomalyType, ImpactLevel } from '../../types'

interface StatBlock {
  label: string
  value: number
  icon: string
  color: string
  onClick: () => void
  hint?: string
}

export default function OverviewBar() {
  const setStatusFilter = useAppStore((s) => s.setStatusFilter)
  const setAnomalyTypeFilter = useAppStore((s) => s.setAnomalyTypeFilter)
  const setImpactLevelFilter = useAppStore((s) => s.setImpactLevelFilter)
  const resetFilters = useAppStore((s) => s.resetFilters)

  const visitingCount = pets.length
  const anomalyCount = pets.reduce((sum, p) => sum + p.anomalyCount, 0)
  const openAnomalyCount = anomalies.filter((a) => a.status === 'open').length
  const completedCount = pets.filter((p) => p.status === 'completed').length

  const blocks: StatBlock[] = [
    {
      label: '在访宠物数',
      value: visitingCount,
      icon: '🐾',
      color: 'from-clay-500 to-clay-400',
      hint: '点击查看全部',
      onClick: () => {
        resetFilters()
      },
    },
    {
      label: '异常条数',
      value: anomalyCount,
      icon: '⚠️',
      color: 'from-rust-500 to-rust-400',
      hint: '点击筛选复核中',
      onClick: () => {
        resetFilters()
        setStatusFilter('reviewing' as Status)
      },
    },
    {
      label: '待人工复核',
      value: openAnomalyCount,
      icon: '🔍',
      color: 'from-amber-500 to-amber-400',
      hint: '点击筛选待处理',
      onClick: () => {
        resetFilters()
        setStatusFilter('pending' as Status)
        setImpactLevelFilter('high' as ImpactLevel)
      },
    },
    {
      label: '已完成追踪',
      value: completedCount,
      icon: '🎉',
      color: 'from-sage-500 to-sage-400',
      hint: '点击筛选已完成',
      onClick: () => {
        resetFilters()
        setStatusFilter('completed' as Status)
      },
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {blocks.map((b) => (
        <button
          key={b.label}
          onClick={b.onClick}
          className="card p-5 text-left group hover:-translate-y-0.5 transition-transform relative overflow-hidden"
        >
          <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${b.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-xs text-clay-500 font-medium">{b.label}</div>
              <div className="num text-4xl font-bold text-clay-800 mt-2 tracking-tight">{b.value}</div>
              {b.hint && <div className="text-[11px] text-clay-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">{b.hint} →</div>}
            </div>
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${b.color} flex items-center justify-center text-2xl shadow-sm`}>
              {b.icon}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
