import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { BoundaryStatus } from '@/types'

const statusStyles: Record<BoundaryStatus, string> = {
  pending_review: 'bg-amber-500/20 text-amber-400',
  reviewed: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-green-500/20 text-green-400',
}

const statusLabels: Record<BoundaryStatus, string> = {
  pending_review: '待复核',
  reviewed: '已复核',
  resolved: '已解决',
}

export default function TracePanel() {
  const tracePanelOpen = useStore(s => s.tracePanelOpen)
  const selectedAnomalyId = useStore(s => s.selectedAnomalyId)
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const anomalyPoints = useStore(s => s.anomalyPoints)
  const selectAnomaly = useStore(s => s.selectAnomaly)

  if (!tracePanelOpen || !selectedAnomalyId) return null

  const record = boundaryRecords.find(r => r.id === selectedAnomalyId)
  if (!record) return null

  const anomalyPoint = anomalyPoints.find(ap => ap.recordId === selectedAnomalyId)

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-[300px] animate-slide-in flex-col gap-4 overflow-y-auto bg-indigo-900 p-5 text-gray-200 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">溯源信息</h3>
        <button onClick={() => selectAnomaly(null)}>
          <X className="h-5 w-5 text-gray-400 hover:text-white" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs text-gray-400">为什么被留下</p>
          <p className="text-sm">{record.reason}</p>
        </div>

        <div>
          <p className="mb-1 text-xs text-gray-400">还缺什么材料</p>
          <p className="text-sm">{record.missingMaterial}</p>
        </div>

        <div>
          <p className="mb-1 text-xs text-gray-400">下一步</p>
          <span className="inline-block rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">
            {record.nextAction}
          </span>
        </div>

        <div>
          <p className="mb-1 text-xs text-gray-400">当前状态</p>
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusStyles[record.status]}`}>
            {statusLabels[record.status]}
          </span>
        </div>
      </div>

      <div className="mt-auto space-y-2 border-t border-indigo-700 pt-4">
        <Link
          to="/"
          className="block rounded-md bg-indigo-800 px-3 py-2 text-center text-sm text-gray-300 hover:bg-indigo-700 hover:text-white"
        >
          → 边界值说明
        </Link>
        {anomalyPoint?.linkedWeightId && (
          <Link
            to="/weights"
            className="block rounded-md bg-indigo-800 px-3 py-2 text-center text-sm text-gray-300 hover:bg-indigo-700 hover:text-white"
          >
            → 评分权重表
          </Link>
        )}
      </div>
    </div>
  )
}
