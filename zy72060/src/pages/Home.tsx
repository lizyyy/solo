import { Suspense } from 'react'
import CraneScene from '@/components/crane/CraneScene'
import TracePanel from '@/components/trace/TracePanel'
import ConflictPanel from '@/components/trace/ConflictPanel'
import { useStore } from '@/store/useStore'
import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react'

function StatsBar() {
  const { points } = useStore()
  const normal = points.filter((p) => p.status === 'normal').length
  const anomaly = points.filter((p) => p.status === 'anomaly').length
  const conflict = points.filter((p) => p.status === 'conflict').length
  const pending = points.filter((p) => p.status === 'pending').length

  return (
    <div className="absolute bottom-4 left-4 flex items-center gap-3 z-10">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0F1923]/80 backdrop-blur-sm border border-slate-700/30">
        <CheckCircle size={12} className="text-emerald-400" />
        <span className="text-[10px] text-emerald-400">{normal}</span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0F1923]/80 backdrop-blur-sm border border-slate-700/30">
        <XCircle size={12} className="text-red-400" />
        <span className="text-[10px] text-red-400">{anomaly}</span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0F1923]/80 backdrop-blur-sm border border-slate-700/30">
        <AlertTriangle size={12} className="text-amber-400" />
        <span className="text-[10px] text-amber-400">{conflict}</span>
      </div>
      {pending > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0F1923]/80 backdrop-blur-sm border border-slate-700/30">
          <HelpCircle size={12} className="text-slate-400" />
          <span className="text-[10px] text-slate-400">{pending}</span>
        </div>
      )}
    </div>
  )
}

function PointList() {
  const { points, selectedPointId, selectPoint, filterStatus } = useStore()

  const filteredPoints = filterStatus === 'all'
    ? points
    : points.filter((p) => p.status === filterStatus)

  const anomalyPoints = filteredPoints.filter((p) => p.status !== 'normal')

  if (anomalyPoints.length === 0) return null

  return (
    <div className="absolute top-4 left-4 z-10 max-h-[60%] overflow-y-auto">
      <div className="bg-[#0F1923]/90 backdrop-blur-md border border-slate-700/50 rounded-lg p-3 w-[240px]">
        <h4 className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">异常/冲突列表</h4>
        <div className="space-y-1">
          {anomalyPoints.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPoint(p.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
                selectedPointId === p.id
                  ? 'bg-slate-700/50 text-slate-200'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  p.status === 'anomaly' ? 'bg-red-400' : 'bg-amber-400'
                }`}
              />
              <span className="truncate">{p.label} · {p.component} · {p.inspectItem}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="relative w-full h-full">
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-[#0A1520]">
            <div className="text-slate-500 text-sm">加载3D场景...</div>
          </div>
        }
      >
        <CraneScene />
      </Suspense>
      <StatsBar />
      <PointList />
      <TracePanel />
      <ConflictPanel />
    </div>
  )
}
