import { useMemo } from 'react'
import { useWaterQualityStore } from '@/store'
import { SOURCE_TYPE_LABELS } from '@/types'
import { Filter, Search } from 'lucide-react'

const anomalyOptions = [
  { value: '', label: '全部' },
  { value: 'anomaly', label: '异常' },
  { value: 'normal', label: '正常' },
]

const sourceTypeOptions = [
  { value: '', label: '全部来源' },
  { value: 'original', label: SOURCE_TYPE_LABELS.original },
  { value: 'late_attachment', label: SOURCE_TYPE_LABELS.late_attachment },
  { value: 'supplementary_note', label: SOURCE_TYPE_LABELS.supplementary_note },
  { value: 'latest_export', label: SOURCE_TYPE_LABELS.latest_export },
]

export default function FilterBar() {
  const allRecords = useWaterQualityStore((s) => s.records)
  const allDataSources = useWaterQualityStore((s) => s.dataSources)
  const filterStation = useWaterQualityStore((s) => s.filterStation)
  const filterAnomaly = useWaterQualityStore((s) => s.filterAnomaly)
  const filterSourceType = useWaterQualityStore((s) => s.filterSourceType)
  const setFilterStation = useWaterQualityStore((s) => s.setFilterStation)
  const setFilterAnomaly = useWaterQualityStore((s) => s.setFilterAnomaly)
  const setFilterSourceType = useWaterQualityStore((s) => s.setFilterSourceType)

  const recordCount = useMemo(() => {
    let filtered = allRecords
    if (filterStation) {
      filtered = filtered.filter((r) => r.stationName.includes(filterStation))
    }
    if (filterAnomaly === 'anomaly') {
      filtered = filtered.filter((r) => r.isAnomaly)
    } else if (filterAnomaly === 'normal') {
      filtered = filtered.filter((r) => !r.isAnomaly)
    }
    if (filterSourceType) {
      const recordIds = new Set(
        allDataSources.filter((ds) => ds.sourceType === filterSourceType).map((ds) => ds.recordId)
      )
      filtered = filtered.filter((r) => recordIds.has(r.id))
    }
    return filtered.length
  }, [allRecords, filterStation, filterAnomaly, filterSourceType, allDataSources])

  return (
    <div className="flex items-center gap-3 border-b border-tide/20 bg-ocean-900/90 px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-tide">
        <Filter size={14} />
        <span className="text-xs font-medium">筛选</span>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-md border border-ocean-600 bg-ocean-800/60 px-2 py-1">
          <Search size={12} className="text-foam/40" />
          <input
            type="text"
            placeholder="站点名称"
            value={filterStation}
            onChange={(e) => setFilterStation(e.target.value)}
            className="w-28 bg-transparent text-xs text-foam placeholder:text-foam/30 focus:outline-none"
          />
        </div>

        <select
          value={filterAnomaly}
          onChange={(e) => setFilterAnomaly(e.target.value)}
          className="rounded-md border border-ocean-600 bg-ocean-800/60 px-2 py-1 text-xs text-foam focus:border-tide/50 focus:outline-none"
        >
          {anomalyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={filterSourceType}
          onChange={(e) => setFilterSourceType(e.target.value)}
          className="rounded-md border border-ocean-600 bg-ocean-800/60 px-2 py-1 text-xs text-foam focus:border-tide/50 focus:outline-none"
        >
          {sourceTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-foam/50">
        <span className="font-mono text-tide">{recordCount}</span> 条记录
      </div>
    </div>
  )
}
