import { useStore } from '@/store/useStore'
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from '@/types'
import { useNavigate } from 'react-router-dom'
import { X, ExternalLink, AlertCircle, MapPin, Calendar, Ruler } from 'lucide-react'

export default function PointDetail() {
  const selectedPointId = useStore((s) => s.selectedPointId)
  const getPointById = useStore((s) => s.getPointById)
  const getPipeById = useStore((s) => s.getPipeById)
  const selectPoint = useStore((s) => s.selectPoint)
  const navigate = useNavigate()

  if (!selectedPointId) return null

  const point = getPointById(selectedPointId)
  if (!point) return null

  const pipe = getPipeById(point.pipeId)

  return (
    <div className="absolute right-0 top-0 z-30 h-full w-80 animate-slide-in overflow-y-auto border-l border-cyan-500/30 bg-black/70 backdrop-blur-md"
      style={{ borderLeft: '3px solid rgba(0,201,167,0.5)' }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-cyan-400">点位详情</h2>
        <button
          onClick={() => selectPoint(null)}
          className="text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <div className="text-lg font-bold text-white">{point.id}</div>
          <div className="mt-1 text-sm text-gray-400">
            <MapPin size={12} className="mr-1 inline" />
            {pipe?.name ?? point.pipeId}
          </div>
          <div className="mt-1 font-mono text-xs text-gray-500">
            ({point.x}, {point.y}, {point.z})
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: SEVERITY_COLORS[point.severity] }}
          >
            {SEVERITY_LABELS[point.severity]}
          </span>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
              point.status === 'anomaly'
                ? 'border-yellow-500 text-yellow-400'
                : point.status === 'exception'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-green-500 text-green-400'
            }`}
          >
            {STATUS_LABELS[point.status]}
          </span>
        </div>

        <div className="inline-block rounded bg-cyan-900/40 px-2 py-0.5 text-xs text-cyan-300">
          {SOURCE_LABELS[point.source]}
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar size={12} />
          <span>巡检日期: {point.inspectedAt.slice(0, 10)}</span>
        </div>

        <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="flex items-center gap-2">
            <Ruler size={14} className="text-cyan-400" />
            <span className="text-xs text-gray-400">深度</span>
          </div>
          {point.depth != null ? (
            <div className="text-sm font-semibold text-white">{point.depth} mm</div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle size={12} />
              数据缺失
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <Ruler size={14} className="text-cyan-400" />
            <span className="text-xs text-gray-400">壁厚</span>
          </div>
          {point.thickness != null ? (
            <div className="text-sm font-semibold text-white">{point.thickness} mm</div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle size={12} />
              数据缺失
            </div>
          )}
        </div>

        {point.description && (
          <div className="text-sm leading-relaxed text-gray-300">{point.description}</div>
        )}

        <button
          onClick={() => navigate(`/record/${point.id}`)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/10 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
        >
          <ExternalLink size={14} />
          查看详情
        </button>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
