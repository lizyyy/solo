import React, { useMemo } from 'react'
import { Cloud, Clock, AlertTriangle, RotateCcw, CheckCircle2 } from 'lucide-react'
import { useStationStore } from '@/store/stationStore'
import { AnomalyFilterKey } from '@/types/station'
import StationRow from './StationRow'

const filters: { key: AnomalyFilterKey; label: string; icon: React.ReactNode }[] = [
  { key: 'cloud_heavy', label: '云遮严重', icon: <Cloud size={14} /> },
  { key: 'time_conflict', label: '时间冲突', icon: <Clock size={14} /> },
  { key: 'result_abnormal', label: '结果超阈', icon: <AlertTriangle size={14} /> },
]

const AnomalyQueue: React.FC = () => {
  const {
    records,
    anomalyFilters,
    toggleAnomalyFilter,
    resetFilters,
    getLatestByStation,
  } = useStationStore()

  const latestList = useMemo(() => getLatestByStation(), [records, getLatestByStation])

  const filtered = useMemo(() => {
    const active = Object.entries(anomalyFilters)
      .filter(([, v]) => v)
      .map(([k]) => k as AnomalyFilterKey)

    if (active.length === 0) return []

    return latestList.filter((r) => {
      for (const key of active) {
        if (key === 'cloud_heavy' && r.cloud_impact === '严重') return true
        if (key === 'time_conflict' && r.time_conflict) return true
        if (key === 'result_abnormal' && r.result_abnormal) return true
      }
      return false
    })
  }, [latestList, anomalyFilters])

  const hasAnyActive = Object.values(anomalyFilters).some(Boolean)

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-deepsea-600/40 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((f) => {
            const active = anomalyFilters[f.key]
            return (
              <button
                key={f.key}
                onClick={() => toggleAnomalyFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 border ${
                  active
                    ? 'bg-coral/15 text-coral-glow border-coral/60 shadow-[0_0_10px_rgba(255,122,69,0.35)]'
                    : 'bg-deepsea-800/50 text-deepsea-200/80 border-deepsea-500/40 hover:border-deepsea-400/70 hover:text-deepsea-100'
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            )
          })}
        </div>

        <button
          onClick={resetFilters}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] text-deepsea-200/80 hover:text-teal-glow hover:bg-teal-glow/10 transition-all"
        >
          <RotateCcw size={12} />
          重置
        </button>
      </div>

      <div className="px-4 py-2 flex items-center justify-between text-[11px] text-deepsea-200/70 border-b border-deepsea-600/30">
        <span>
          命中{' '}
          <span className="text-coral-glow font-mono font-semibold">
            {filtered.length}
          </span>{' '}
          条异常记录
        </span>
        {!hasAnyActive && (
          <span className="text-alert-yellow/90">请至少勾选一项筛选条件</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-deepsea-300/70 px-6 text-center">
            <CheckCircle2
              size={52}
              className="text-alert-green/70 mb-4 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]"
            />
            <p className="text-[14px] text-alert-green/90 font-medium">
              当前筛选下无异常，👍
            </p>
            <p className="text-[11px] mt-2 opacity-80">
              {hasAnyActive
                ? '所有站点均已符合该筛选条件的核查标准'
                : '勾选上方筛选条件开始排查'}
            </p>
          </div>
        ) : (
          filtered.map((record) => (
            <StationRow key={record.id} record={record} />
          ))
        )}
      </div>
    </div>
  )
}

export default AnomalyQueue
