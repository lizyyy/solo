import { MapPin, Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { useTrailStore } from '@/store/useStore'

export default function StatsBar() {
  const points = useTrailStore((state) => state.points)
  const statuses = useTrailStore((state) => state.statuses)
  const getUnresolvedConflicts = useTrailStore((state) => state.getUnresolvedConflicts)

  const total = points.length
  const crowded = statuses.filter((s) => s.status === 'crowded').length
  const normal = statuses.filter((s) => s.status === 'normal').length
  const pending = statuses.filter((s) => s.status === 'pending_review').length
  const conflicts = getUnresolvedConflicts().length

  const conflictColor = conflicts > 0 ? '#ff6b35' : '#4ecdc4'

  const stats = [
    { icon: MapPin, value: total, label: '总点位' },
    { icon: Users, value: crowded, label: '拥挤', color: '#ef4444' },
    { icon: CheckCircle, value: normal, label: '正常', color: '#4ecdc4' },
    { icon: Clock, value: pending, label: '待确认', color: '#ff6b35' },
    { icon: AlertTriangle, value: conflicts, label: '冲突', color: conflictColor },
  ]

  return (
    <div className="flex gap-2">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-lg shadow-sm px-3 py-2 flex items-center gap-2 flex-1 min-w-0">
          <stat.icon size={16} style={{ color: stat.color || '#1a535c' }} className="shrink-0" />
          <div className="min-w-0">
            <div className="text-lg font-bold leading-tight" style={{ color: stat.color || '#1a535c' }}>
              {stat.value}
            </div>
            <div className="text-xs text-gray-500 leading-tight">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
