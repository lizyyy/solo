import { useState } from 'react'
import { useStore } from '@/lib/store'
import { MERGE_TYPE_LABELS, STATUS_LABELS } from '@/types'
import { MapPin, Copy, Crosshair, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import type { MergeType } from '@/types'

type FilterTab = 'all' | 'pending' | 'confirmed' | 'cancelled'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'confirmed', label: '已确认' },
  { key: 'cancelled', label: '已取消' },
]

const MERGE_ICONS: Record<MergeType, typeof MapPin> = {
  same_name: MapPin,
  duplicate_complaint: Copy,
  coordinate_drift: Crosshair,
}

export default function MergePage() {
  const { mergeGroups, points, runMergeDetection, confirmMergeGroup, cancelMergeGroup } = useStore()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [detecting, setDetecting] = useState(false)

  const pendingCounts = {
    same_name: mergeGroups.filter(g => g.mergeType === 'same_name' && g.status === 'pending').length,
    duplicate_complaint: mergeGroups.filter(g => g.mergeType === 'duplicate_complaint' && g.status === 'pending').length,
    coordinate_drift: mergeGroups.filter(g => g.mergeType === 'coordinate_drift' && g.status === 'pending').length,
  }

  const filtered = activeTab === 'all'
    ? mergeGroups
    : mergeGroups.filter(g => g.status === activeTab)

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDetect = async () => {
    setDetecting(true)
    await runMergeDetection()
    setDetecting(false)
  }

  return (
    <div>
      <h1 className="font-serif-title text-2xl font-semibold text-teal-800">归并池</h1>
      <p className="text-stone-400 text-sm">自动检测同名路口、重复投诉和坐标偏移</p>

      <div className="flex gap-4 mb-5 mt-4">
        {([
          { key: 'same_name' as MergeType, icon: MapPin, count: pendingCounts.same_name },
          { key: 'duplicate_complaint' as MergeType, icon: Copy, count: pendingCounts.duplicate_complaint },
          { key: 'coordinate_drift' as MergeType, icon: Crosshair, count: pendingCounts.coordinate_drift },
        ]).map(({ key, icon: Icon, count }) => (
          <div key={key} className="card p-4 flex-1">
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-teal-600" />
              <span className="text-2xl font-bold">{count}</span>
            </div>
            <div className="text-sm text-stone-500 mt-1">{MERGE_TYPE_LABELS[key]}</div>
          </div>
        ))}
      </div>

      <button
        className="btn-secondary mb-4 inline-flex items-center gap-2"
        onClick={handleDetect}
        disabled={detecting}
      >
        <RefreshCw className={`w-4 h-4 ${detecting ? 'animate-spin' : ''}`} />
        重新检测
      </button>

      <div className="flex gap-2 mb-4">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {filtered.map(group => {
          const isExpanded = expandedIds.has(group.id)
          const Icon = MERGE_ICONS[group.mergeType]
          const mergedPoints = group.mergedIds
            .map(id => points.find(p => p.id === id))
            .filter(Boolean)

          return (
            <div key={group.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
                  <Icon className="w-3 h-3" />
                  {MERGE_TYPE_LABELS[group.mergeType]}
                </span>
                <span className={`status-badge-${group.status} px-2 py-0.5 rounded text-xs font-medium`}>
                  {STATUS_LABELS[group.status]}
                </span>
              </div>

              <p className="font-medium mb-2">{group.reason}</p>

              <button
                className="text-sm text-teal-600 hover:text-teal-800 inline-flex items-center gap-1"
                onClick={() => toggleExpand(group.id)}
              >
                {isExpanded ? '收起详情' : '展开详情'}
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isExpanded && (
                <div className="mt-3 border-t border-stone-200 pt-3 space-y-2">
                  {mergedPoints.map(point => point && (
                    <div key={point.id} className="text-sm bg-stone-50 rounded p-2">
                      <div className="font-medium">{point.name}</div>
                      <div className="text-stone-500">
                        {point.district} · {point.complaintId} · {point.complaintTime}
                      </div>
                      {point.longitude != null && point.latitude != null && (
                        <div className="text-stone-400">
                          坐标: {point.longitude.toFixed(6)}, {point.latitude.toFixed(6)}
                        </div>
                      )}
                      <div className="text-xs text-stone-400 mt-1">来源: {point.sourceTrace}</div>
                    </div>
                  ))}
                </div>
              )}

              {group.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button className="btn-primary" onClick={() => confirmMergeGroup(group.id)}>
                    确认归并
                  </button>
                  <button className="btn-secondary" onClick={() => cancelMergeGroup(group.id)}>
                    取消归并
                  </button>
                </div>
              )}

              {group.status === 'confirmed' && (
                <div className="bg-teal-50 p-3 rounded text-sm mt-3">
                  归并原因: {group.reason}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
