import React, { useMemo, useState } from 'react'
import { useStationStore } from '@/store/stationStore'
import StationList from './StationList'
import AnomalyQueue from './AnomalyQueue'

type TabKey = 'all' | 'anomaly'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部站点' },
  { key: 'anomaly', label: '异常队列' },
]

const SidePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const { records, getLatestByStation, anomalyFilters } = useStationStore()

  const latestList = useMemo(() => getLatestByStation(), [records, getLatestByStation])

  const countAll = latestList.length
  const countAnomaly = useMemo(() => {
    const active = Object.entries(anomalyFilters)
      .filter(([, v]) => v)
      .map(([k]) => k as 'cloud_heavy' | 'time_conflict' | 'result_abnormal')

    if (active.length === 0) return 0

    return latestList.filter((r) => {
      for (const key of active) {
        if (key === 'cloud_heavy' && r.cloud_impact === '严重') return true
        if (key === 'time_conflict' && r.time_conflict) return true
        if (key === 'result_abnormal' && r.result_abnormal) return true
      }
      return false
    }).length
  }, [latestList, anomalyFilters])

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 flex items-stretch border-b border-deepsea-500/40 px-2 pt-2">
        {tabs.map((t) => {
          const active = activeTab === t.key
          const badgeCount = t.key === 'all' ? countAll : countAnomaly
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`relative flex-1 flex items-center justify-center gap-2 px-4 text-[14px] font-medium rounded-t-lg transition-all duration-200 ${
                active
                  ? 'bg-deepsea-700/60 text-teal-glow border-t border-x border-deepsea-400/50'
                  : 'text-deepsea-200/80 hover:text-deepsea-50 hover:bg-deepsea-700/30'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-full text-[10px] font-semibold tracking-tight ${
                  active
                    ? 'bg-teal-glow/20 text-teal-glow border border-teal-glow/50'
                    : 'bg-deepsea-600/60 text-deepsea-100/90 border border-deepsea-500/40'
                }`}
              >
                {badgeCount}
              </span>
              {active && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-teal-glow shadow-[0_0_8px_rgba(0,212,170,0.6)] rounded-t" />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'all' ? <StationList /> : <AnomalyQueue />}
      </div>
    </div>
  )
}

export default SidePanel
