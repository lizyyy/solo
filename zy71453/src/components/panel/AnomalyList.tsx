import { useMemo } from 'react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { AnomalyRecord, AnomalyTabType } from '../../utils/types'

const TAB_CONFIG: { key: AnomalyTabType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'path_through_shelf', label: '穿架' },
  { key: 'battery_drop', label: '电量' },
  { key: 'time_misalignment', label: '时序' },
  { key: 'missing_field', label: '缺字段' },
]

const SEVERITY_ICON = {
  critical: { Icon: AlertTriangle, color: '#ef4444' },
  warning: { Icon: AlertCircle, color: '#ff8c00' },
  info: { Icon: Info, color: '#3b82f6' },
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: '待确认', color: '#eab308' },
  confirmed: { label: '已确认', color: '#22c55e' },
  rejected: { label: '已驳回', color: '#ef4444' },
}

export default function AnomalyList() {
  const anomalies = useStore((s) => s.anomalies)
  const anomalyTab = useStore((s) => s.anomalyTab)
  const setAnomalyTab = useStore((s) => s.setAnomalyTab)
  const setSelectedAnomalyId = useStore((s) => s.setSelectedAnomalyId)
  const selectedAnomalyId = useStore((s) => s.selectedAnomalyId)

  const filtered = useMemo(
    () => (anomalyTab === 'all' ? anomalies : anomalies.filter((a) => a.type === anomalyTab)),
    [anomalies, anomalyTab],
  )

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: anomalies.length }
    for (const a of anomalies) {
      counts[a.type] = (counts[a.type] || 0) + 1
    }
    return counts
  }, [anomalies])

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-gray-700 pb-1">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAnomalyTab(tab.key)}
            className={`flex items-center gap-1 rounded-t px-2 py-1.5 text-xs transition-colors ${
              anomalyTab === tab.key
                ? 'bg-[#111827] text-[#00f0ff] border-b-2 border-[#00f0ff]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                anomalyTab === tab.key
                  ? 'bg-[#00f0ff]/20 text-[#00f0ff]'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {tabCounts[tab.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {filtered.map((anomaly) => (
          <AnomalyCard
            key={anomaly.id}
            anomaly={anomaly}
            isSelected={anomaly.id === selectedAnomalyId}
            onClick={() => setSelectedAnomalyId(anomaly.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-500">暂无异常</div>
        )}
      </div>
    </div>
  )
}

function AnomalyCard({
  anomaly,
  isSelected,
  onClick,
}: {
  anomaly: AnomalyRecord
  isSelected: boolean
  onClick: () => void
}) {
  const { Icon, color } = SEVERITY_ICON[anomaly.severity]
  const badge = STATUS_BADGE[anomaly.status]

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-3 cursor-pointer transition-all hover:border-gray-500 ${
        isSelected
          ? 'border-[#00f0ff] bg-[#00f0ff]/5'
          : 'border-gray-700 bg-[#111827]'
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-200 leading-relaxed">{anomaly.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${badge.color}22`, color: badge.color }}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">
            来源: {anomaly.source.file} 行{anomaly.source.line}
          </p>
        </div>
      </div>
    </div>
  )
}
