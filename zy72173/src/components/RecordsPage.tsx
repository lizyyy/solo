import { useStore } from '@/store/useStore'
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS } from '@/types'
import type { InspectionPoint } from '@/types'
import { MapPin, Clock, User, Camera, MessageSquareWarning, Archive, Copy, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import PointDetail from './PointDetail'

const sourceIcon = {
  inspection_photo: Camera,
  complaint: MessageSquareWarning,
  old_standard: Archive,
}

function RecordCard({ point, onSelect }: { point: InspectionPoint; onSelect: () => void }) {
  const sameNameCount = useStore((s) => s.points.filter((p) => p.intersectionName === point.intersectionName && p.id !== point.id).length)
  const complaints = useStore((s) => s.complaints.filter((c) => c.pointId === point.id))
  const SourceIcon = sourceIcon[point.source]
  const statusColor = STATUS_COLORS[point.status]

  return (
    <div
      onClick={onSelect}
      className="p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:border-opacity-100 group"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderLeftWidth: 3,
        borderLeftColor: statusColor,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin size={14} style={{ color: statusColor }} />
          <span className="text-sm font-semibold">{point.intersectionName}</span>
          <span className="font-mono-data text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}>
            {point.intersectionCode}
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: `${statusColor}20`, color: statusColor }}
        >
          {STATUS_LABELS[point.status]}
        </span>
      </div>

      <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
        {point.description}
      </p>

      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <div className="flex items-center gap-1">
          <SourceIcon size={12} />
          <span>{SOURCE_LABELS[point.source]}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{point.inspectDate}</span>
        </div>
        <div className="flex items-center gap-1">
          <User size={12} />
          <span>{point.inspector ?? '未指定'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        {sameNameCount > 0 && (
          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-accent)' }}>
            <Copy size={10} />
            同名路口×{sameNameCount}
          </span>
        )}
        {point.coordDrift && (
          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-accent)' }}>
            <AlertTriangle size={10} />
            坐标偏移
          </span>
        )}
        {complaints.length > 0 && (
          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(249, 115, 22, 0.15)', color: 'var(--color-pending)' }}>
            <MessageSquareWarning size={10} />
            投诉×{complaints.length}
          </span>
        )}
      </div>
    </div>
  )
}

export default function RecordsPage() {
  const { getFilteredPoints, statusFilter, setStatusFilter, searchQuery, setSearchQuery, selectPoint, points } = useStore()
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)

  const filteredPoints = getFilteredPoints()

  const statusCounts = {
    all: points.length,
    completed: points.filter((p) => p.status === 'completed').length,
    pending_verify: points.filter((p) => p.status === 'pending_verify').length,
    need_onsite: points.filter((p) => p.status === 'need_onsite').length,
  }

  const handleSelect = (id: string) => {
    setSelectedRecordId(id)
    selectPoint(id)
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold mb-1">巡检记录</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>查看全部巡检点位记录，按状态筛选或搜索</p>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索路口名、编号、描述..."
            className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none transition-colors"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />
        </div>

        <div className="flex items-center gap-2 mb-5">
          {(['all', 'completed', 'pending_verify', 'need_onsite'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: statusFilter === status ? 'var(--color-accent)' : 'var(--color-surface)',
                color: statusFilter === status ? '#0F172A' : 'var(--color-text-muted)',
                border: `1px solid ${statusFilter === status ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            >
              {status === 'all' ? '全部' : STATUS_LABELS[status]} ({statusCounts[status]})
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {filteredPoints.map((point) => (
            <RecordCard key={point.id} point={point} onSelect={() => handleSelect(point.id)} />
          ))}
          {filteredPoints.length === 0 && (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              没有匹配的记录
            </div>
          )}
        </div>
      </div>

      {selectedRecordId && <PointDetail />}
    </div>
  )
}
