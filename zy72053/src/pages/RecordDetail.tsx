import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  QC_ISSUE_LABELS,
  JUDGMENT_TYPE_LABELS,
} from '@/types'
import type { ConflictResolution } from '@/types'
import {
  ArrowLeft,
  AlertCircle,
  MapPin,
  Calendar,
  Ruler,
  FileText,
  Image as ImageIcon,
  Gavel,
  X,
} from 'lucide-react'

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const getPointById = useStore((s) => s.getPointById)
  const getPipeById = useStore((s) => s.getPipeById)
  const getPhotosByPointId = useStore((s) => s.getPhotosByPointId)
  const getQCByPointId = useStore((s) => s.getQCByPointId)
  const getJudgmentsByPointId = useStore((s) => s.getJudgmentsByPointId)
  const getConflictByPointId = useStore((s) => s.getConflictByPointId)
  const resolveConflict = useStore((s) => s.resolveConflict)
  const addJudgment = useStore((s) => s.addJudgment)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  if (!id) return null
  const point = getPointById(id)
  if (!point) return <div className="flex h-screen items-center justify-center text-gray-400" style={{ background: '#0A1628' }}>未找到记录</div>

  const pipe = getPipeById(point.pipeId)
  const photos = getPhotosByPointId(id)
  const qcRecords = getQCByPointId(id)
  const judgments = getJudgmentsByPointId(id)
  const conflict = getConflictByPointId(id)

  const handleResolve = (resolution: ConflictResolution) => {
    if (!conflict) return
    resolveConflict(conflict.id, resolution, '当前用户')
    const side = resolution === 'data_side' ? '数据侧' : resolution === 'photo_side' ? '照片侧' : '手动覆盖'
    addJudgment({
      pointId: id,
      operator: '当前用户',
      judgmentType: 'conflict_resolution',
      oldValue: conflict.resolution,
      newValue: resolution,
      reason: `采纳${side}证据`,
    })
  }

  const fmt = (iso: string) => iso.slice(0, 19).replace('T', ' ')

  return (
    <div className="min-h-screen overflow-y-auto p-6" style={{ background: '#0A1628' }}>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/data" className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300">
          <ArrowLeft size={18} /> 返回
        </Link>
        <h1 className="text-xl font-bold text-white">记录详情</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="rounded-lg border-l-4 border-cyan-400 bg-white/5 p-5" style={{ borderLeftColor: 'rgba(0,201,167,0.7)' }}>
            <h2 className="mb-4 text-sm font-semibold text-cyan-400">基本信息卡</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-white">{point.id}</span>
                <span className="rounded-full px-3 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: SEVERITY_COLORS[point.severity] }}>
                  {SEVERITY_LABELS[point.severity]}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  point.status === 'anomaly' ? 'border-yellow-500 text-yellow-400' :
                  point.status === 'exception' ? 'border-orange-500 text-orange-400' :
                  'border-green-500 text-green-400'
                }`}>
                  {STATUS_LABELS[point.status]}
                </span>
                <span className="rounded bg-cyan-900/40 px-2 py-0.5 text-xs text-cyan-300">
                  {SOURCE_LABELS[point.source]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin size={14} className="text-cyan-400" />
                  <span>{pipe?.name ?? point.pipeId}</span>
                  <span className="font-mono text-xs text-gray-500">({point.x}, {point.y}, {point.z})</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <FileText size={14} className="text-cyan-400" />
                  <span className="font-mono text-xs">{point.sourceFile}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar size={14} className="text-cyan-400" />
                  <span>导入: <span className="font-mono">{fmt(point.importedAt)}</span></span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar size={14} className="text-cyan-400" />
                  <span>巡检: <span className="font-mono">{fmt(point.inspectedAt)}</span></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Ruler size={14} className="text-cyan-400" /> 深度
                  </div>
                  {point.depth != null ? (
                    <div className="mt-1 font-mono text-sm font-semibold text-white">{point.depth} mm</div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1 text-xs text-red-400"><AlertCircle size={12} /> 数据缺失</div>
                  )}
                </div>
                <div className="rounded border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Ruler size={14} className="text-cyan-400" /> 壁厚
                  </div>
                  {point.thickness != null ? (
                    <div className="mt-1 font-mono text-sm font-semibold text-white">{point.thickness} mm</div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1 text-xs text-red-400"><AlertCircle size={12} /> 数据缺失</div>
                  )}
                </div>
              </div>

              {point.description && (
                <p className="text-sm leading-relaxed text-gray-300">{point.description}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-400">照片对照区</h2>
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {photos.map((p) => (
                  <div key={p.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    <img
                      src={p.thumbnailUrl}
                      alt={p.fileName}
                      className="h-36 w-full cursor-pointer object-cover hover:opacity-80"
                      onClick={() => setLightboxSrc(p.thumbnailUrl)}
                    />
                    <div className="p-2">
                      <div className="text-xs font-medium text-white">{p.fileName}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{p.description}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{fmt(p.takenAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                <ImageIcon size={32} className="mb-2" />
                <span className="text-sm">暂无巡检照片</span>
              </div>
            )}
          </div>

          {conflict && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-sm font-semibold text-cyan-400">证据并排视图</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-4">
                  <div className="mb-2 text-xs font-semibold text-blue-400">数据侧证据</div>
                  <p className="text-sm text-gray-300">{conflict.dataEvidence}</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
                  <div className="mb-2 text-xs font-semibold text-amber-400">照片侧证据</div>
                  <p className="text-sm text-gray-300">{conflict.photoEvidence}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-950/20 p-4">
                <div className="mb-1 text-xs font-semibold text-cyan-400">建议</div>
                <p className="text-sm text-gray-300">{conflict.suggestion}</p>
              </div>
              {conflict.resolution === 'pending' && (
                <div className="mt-4 flex gap-3">
                  <button onClick={() => handleResolve('data_side')} className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20">
                    采纳数据侧
                  </button>
                  <button onClick={() => handleResolve('photo_side')} className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/20">
                    采纳照片侧
                  </button>
                  <button onClick={() => handleResolve('manual_override')} className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-400 hover:bg-cyan-500/20">
                    手动覆盖
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-400">来源追溯链</h2>
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-cyan-500/30" />
              <div className="relative mb-6">
                <div className="absolute -left-4 top-0.5 h-3 w-3 rounded-full border-2 border-cyan-400 bg-cyan-400/30" />
                <div className="text-xs text-gray-500">原始数据源</div>
                <div className="mt-0.5 text-sm text-white">{SOURCE_LABELS[point.source]}</div>
                <div className="font-mono text-xs text-gray-400">{point.sourceFile}</div>
              </div>
              <div className="relative mb-6">
                <div className="absolute -left-4 top-0.5 h-3 w-3 rounded-full border-2 border-cyan-400 bg-cyan-400/30" />
                <div className="text-xs text-gray-500">导入时间</div>
                <div className="mt-0.5 font-mono text-sm text-white">{fmt(point.importedAt)}</div>
              </div>
              <div className="relative mb-6">
                <div className="absolute -left-4 top-0.5 h-3 w-3 rounded-full border-2 border-cyan-400 bg-cyan-400/30" />
                <div className="text-xs text-gray-500">质控结果</div>
                {qcRecords.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {qcRecords.map((qc) => (
                      <div key={qc.id} className={`rounded border px-2 py-1 text-xs ${qc.status === 'open' ? 'border-red-500/40 text-red-400' : 'border-green-500/40 text-green-400'}`}>
                        {QC_ISSUE_LABELS[qc.issueType]} - {qc.status === 'open' ? '待处理' : '已解决'}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-gray-500">无质控记录</div>
                )}
              </div>
              <div className="relative">
                <div className="absolute -left-4 top-0.5 h-3 w-3 rounded-full border-2 border-cyan-400 bg-cyan-400/30" />
                <div className="text-xs text-gray-500">当前状态</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: SEVERITY_COLORS[point.severity] }}>
                    {SEVERITY_LABELS[point.severity]}
                  </span>
                  <span className={`text-xs ${point.status === 'anomaly' ? 'text-yellow-400' : point.status === 'exception' ? 'text-orange-400' : 'text-green-400'}`}>
                    {STATUS_LABELS[point.status]}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-400">判断历史时间线</h2>
            {judgments.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-cyan-500/30" />
                {judgments.map((j) => (
                  <div key={j.id} className="relative mb-5 last:mb-0">
                    <div className="absolute -left-4 top-0.5 h-3 w-3 rounded-full border-2 border-cyan-400 bg-cyan-400/30" />
                    <div className="text-xs text-gray-500">{fmt(j.createdAt)}</div>
                    <div className="mt-0.5 text-sm text-white">{j.operator}</div>
                    <div className="mt-0.5 text-xs text-cyan-300">{JUDGMENT_TYPE_LABELS[j.judgmentType]}</div>
                    <div className="mt-1 font-mono text-xs text-gray-400">
                      {j.oldValue} → {j.newValue}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">{j.reason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                <Gavel size={24} className="mb-2" />
                <span className="text-sm">暂无判断记录</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setLightboxSrc(null)}>
          <button className="absolute right-6 top-6 text-white hover:text-gray-300" onClick={() => setLightboxSrc(null)}>
            <X size={28} />
          </button>
          <img src={lightboxSrc} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
