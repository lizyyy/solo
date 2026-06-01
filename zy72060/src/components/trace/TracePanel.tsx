import { useStore } from '@/store/useStore'
import {
  X,
  FileText,
  Clock,
  User,
  MessageSquare,
  AlertTriangle,
  Link2,
  ChevronRight,
  Image,
} from 'lucide-react'
import { useState } from 'react'
import type { TraceRecord } from '@/types'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    normal: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    anomaly: 'bg-red-500/20 text-red-400 border-red-500/30',
    conflict: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }
  const labels: Record<string, string> = {
    normal: '正常',
    anomaly: '异常',
    conflict: '冲突',
    pending: '待处理',
  }
  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${colors[status] || ''}`}>
      {labels[status] || status}
    </span>
  )
}

function SourceTag({ type, sourceRef }: { type: string; sourceRef: string }) {
  const icons: Record<string, typeof FileText> = {
    point_table: FileText,
    photo: Image,
    manual: User,
  }
  const labels: Record<string, string> = {
    point_table: '点位表',
    photo: '巡检照片',
    manual: '手动录入',
  }
  const Icon = icons[type] || FileText
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-700/50 text-slate-300">
      <Icon size={10} />
      {labels[type] || type} · {sourceRef}
    </span>
  )
}

export default function TracePanel() {
  const {
    selectedPointId,
    points,
    traces,
    conflicts,
    photos,
    sidebarOpen,
    toggleSidebar,
    updateTrace,
    openConflictPanel,
  } = useStore()

  const [noteDraft, setNoteDraft] = useState('')
  const [editingTraceId, setEditingTraceId] = useState<string | null>(null)

  const selectedPoint = points.find((p) => p.id === selectedPointId)
  const pointTraces = traces.filter((t) => t.pointId === selectedPointId)
  const pointConflicts = conflicts.filter((c) => c.pointId === selectedPointId)
  const pointPhotos = photos.filter((p) => p.pointId === selectedPointId)

  if (!sidebarOpen || !selectedPoint) return null

  const handleSaveNote = (traceId: string) => {
    if (noteDraft.trim()) {
      updateTrace(traceId, {
        note: noteDraft.trim(),
        processedAt: new Date().toISOString(),
        processedBy: '当前用户',
      })
      setNoteDraft('')
      setEditingTraceId(null)
    }
  }

  const handleAppendNote = (trace: TraceRecord) => {
    const appended = trace.note
      ? `${trace.note}\n[${new Date().toLocaleString('zh-CN')}] ${noteDraft.trim()}`
      : `[${new Date().toLocaleString('zh-CN')}] ${noteDraft.trim()}`
    updateTrace(trace.id, {
      note: appended,
      processedAt: new Date().toISOString(),
      processedBy: '当前用户',
    })
    setNoteDraft('')
    setEditingTraceId(null)
  }

  return (
    <div className="absolute right-0 top-0 h-full w-[380px] bg-[#0F1923]/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Link2 size={14} className="text-[#00E5A0]" />
          溯源详情
        </h3>
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-slate-700/50 rounded transition-colors"
        >
          <X size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-[#00E5A0]">{selectedPoint.label}</span>
            <StatusBadge status={selectedPoint.status} />
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <p>构件: <span className="text-slate-300">{selectedPoint.component}</span></p>
            <p>检测项: <span className="text-slate-300">{selectedPoint.inspectItem}</span></p>
            <p>测量值: <span className="text-slate-300">{selectedPoint.measuredValue}</span></p>
            <p>标准值: <span className="text-slate-300">{selectedPoint.standardValue}</span></p>
            <p>判定: <span className="text-slate-300">{selectedPoint.judgment}</span></p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <SourceTag type={selectedPoint.sourceType} sourceRef={selectedPoint.sourceRef} />
          </div>
        </div>

        {pointPhotos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Image size={12} /> 关联照片
            </h4>
            {pointPhotos.map((photo) => (
              <div key={photo.id} className="rounded-lg overflow-hidden border border-slate-700/50">
                <img
                  src={photo.dataUrl}
                  alt={photo.fileName}
                  className="w-full h-32 object-cover"
                />
                <div className="p-2 bg-slate-800/50 text-xs text-slate-400">
                  <p className="text-slate-300">{photo.fileName}</p>
                  <p>{photo.description}</p>
                  <p className="mt-1 text-slate-500">{new Date(photo.capturedAt).toLocaleString('zh-CN')}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {pointConflicts.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => openConflictPanel(selectedPoint.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors"
            >
              <AlertTriangle size={14} />
              <span className="flex-1 text-left">存在 {pointConflicts.length / 2} 组冲突证据</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1">
            <MessageSquare size={12} /> 溯源记录
          </h4>
          {pointTraces.length === 0 && (
            <p className="text-xs text-slate-500 italic">暂无溯源记录</p>
          )}
          {pointTraces.map((trace) => (
            <div
              key={trace.id}
              className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <FileText size={10} />
                <span>{trace.sourceRow}</span>
                <span className="text-slate-600">|</span>
                <SourceTag type={trace.sourceType} sourceRef={trace.sourceRow} />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{trace.sourceContent}</p>

              {trace.note && (
                <div className="rounded bg-slate-700/30 p-2">
                  <p className="text-xs text-[#00E5A0] leading-relaxed whitespace-pre-wrap">{trace.note}</p>
                </div>
              )}

              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {trace.processedAt ? new Date(trace.processedAt).toLocaleString('zh-CN') : '未处理'}
                </span>
                <span className="flex items-center gap-1">
                  <User size={10} /> {trace.processedBy || '—'}
                </span>
              </div>

              {editingTraceId === trace.id ? (
                <div className="space-y-2">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="输入备注..."
                    className="w-full px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-600/50 rounded text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[#00E5A0]/50 resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAppendNote(trace)}
                      className="px-2 py-1 text-xs bg-[#00E5A0]/20 text-[#00E5A0] rounded hover:bg-[#00E5A0]/30 transition-colors"
                    >
                      追加
                    </button>
                    <button
                      onClick={() => {
                        setEditingTraceId(null)
                        setNoteDraft('')
                      }}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingTraceId(trace.id)
                    setNoteDraft('')
                  }}
                  className="text-[10px] text-slate-500 hover:text-[#00E5A0] transition-colors"
                >
                  + 追加备注
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
