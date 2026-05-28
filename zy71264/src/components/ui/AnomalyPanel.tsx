import { useState } from 'react'
import { Wind, ZapOff, EyeOff } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import type { AnomalyType, AnomalyItem, Severity } from '@/types'

export default function AnomalyPanel() {
  const { anomalyPanelOpen, anomalies, setSelectedAnomalyId, selectedAnomalyId } = useStore()
  const [activeTab, setActiveTab] = useState<AnomalyType | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const tabs: { key: AnomalyType | 'all'; label: string; icon?: typeof Wind }[] = [
    { key: 'all', label: '异常列表' },
    { key: 'reversed_airflow', label: '风向反', icon: Wind },
    { key: 'missing_power', label: '功耗缺失', icon: ZapOff },
    { key: 'hotspot_occluded', label: '热点遮挡', icon: EyeOff },
  ]

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'warning':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'info':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    }
  }

  const getSeverityLabel = (severity: Severity) => {
    switch (severity) {
      case 'critical':
        return '严重'
      case 'warning':
        return '警告'
      case 'info':
        return '提示'
    }
  }

  const getTypeIcon = (type: AnomalyType) => {
    switch (type) {
      case 'reversed_airflow':
        return Wind
      case 'missing_power':
        return ZapOff
      case 'hotspot_occluded':
        return EyeOff
    }
  }

  const filteredAnomalies = anomalies.filter((a) => activeTab === 'all' || a.type === activeTab)

  const getCount = (key: AnomalyType | 'all') => {
    if (key === 'all') return anomalies.length
    return anomalies.filter((a) => a.type === key).length
  }

  const handleLocate = (anomaly: AnomalyItem) => {
    setSelectedAnomalyId(anomaly.id)
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 h-64 bg-dc-panel border-t border-dc-border z-40 transform transition-transform duration-300 ease-in-out',
        anomalyPanelOpen ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center border-b border-dc-border">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            const count = getCount(tab.key)
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'text-dc-cold border-dc-cold'
                    : 'text-dc-muted border-transparent hover:text-dc-text'
                )}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {tab.label}
                <span className="px-2 py-0.5 text-xs rounded-full bg-dc-bg text-dc-muted">
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredAnomalies.length === 0 ? (
            <div className="flex items-center justify-center h-full text-dc-muted text-sm">
              暂无异常
            </div>
          ) : (
            filteredAnomalies.map((anomaly) => {
              const Icon = getTypeIcon(anomaly.type)
              const isExpanded = expandedId === anomaly.id
              const isSelected = selectedAnomalyId === anomaly.id
              return (
                <div
                  key={anomaly.id}
                  className={cn(
                    'rounded-lg border transition-colors',
                    isSelected
                      ? 'bg-dc-cold/10 border-dc-cold'
                      : 'bg-dc-bg border-dc-border hover:border-dc-muted'
                  )}
                >
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
                  >
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded border',
                        getSeverityColor(anomaly.severity)
                      )}
                    >
                      {getSeverityLabel(anomaly.severity)}
                    </span>
                    <Icon className="w-5 h-5 text-dc-cold" />
                    <span className="flex-1 text-sm text-dc-text">
                      {anomaly.description}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLocate(anomaly)
                      }}
                      className="px-3 py-1 bg-dc-cold text-dc-bg text-xs font-medium rounded hover:bg-opacity-90 transition-colors"
                    >
                      定位
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 text-sm text-dc-muted border-t border-dc-border">
                      <p className="pt-3">{anomaly.explanation}</p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
