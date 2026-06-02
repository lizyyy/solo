import { useStore } from '@/store/useStore'
import UndergroundMap from '@/components/UndergroundMap'
import PointDetail from '@/components/PointDetail'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import { Layers, ChevronRight } from 'lucide-react'

export default function InspectionMap() {
  const { points, selectedPointId, detailOpen } = useStore()

  const statusSummary = {
    completed: points.filter((p) => p.status === 'completed').length,
    pending_verify: points.filter((p) => p.status === 'pending_verify').length,
    need_onsite: points.filter((p) => p.status === 'need_onsite').length,
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h1 className="text-xl font-bold">巡检地图</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>点击点位查看来源、状态与处理记录</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              {(Object.keys(statusSummary) as Array<keyof typeof statusSummary>).map((status) => (
                <span key={status} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: `${STATUS_COLORS[status]}15`, color: STATUS_COLORS[status] }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                  {STATUS_LABELS[status]} {statusSummary[status]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full rounded-xl border overflow-hidden relative" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(15,23,42,0.85)', color: 'var(--color-text-muted)', backdropFilter: 'blur(4px)' }}>
              <Layers size={13} />
              地下空间 B1/B2 层
            </div>
            <UndergroundMap />
          </div>
        </div>

        {selectedPointId && !detailOpen && (
          <div
            className="px-6 py-3 border-t flex items-center justify-between cursor-pointer transition-colors hover:bg-opacity-50"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            onClick={() => useStore.getState().selectPoint(selectedPointId)}
          >
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              已选中点位，点击查看详情
            </span>
            <ChevronRight size={16} style={{ color: 'var(--color-accent)' }} />
          </div>
        )}
      </div>

      {detailOpen && <PointDetail />}
    </div>
  )
}
