import { useStore } from '@/store/useStore'
import { X, AlertTriangle, Camera, FileText, ArrowRight } from 'lucide-react'

export default function ConflictPanel() {
  const {
    conflictPanelOpen,
    conflictPointId,
    conflicts,
    closeConflictPanel,
  } = useStore()

  if (!conflictPanelOpen || !conflictPointId) return null

  const pointConflicts = conflicts.filter((c) => c.pointId === conflictPointId)
  const photoEvidence = pointConflicts.filter((c) => c.side === 'photo')
  const dataEvidence = pointConflicts.filter((c) => c.side === 'data')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[800px] max-h-[80vh] bg-[#0F1923] border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertTriangle size={16} />
            证据冲突 — 请手动判定
          </h3>
          <button
            onClick={closeConflictPanel}
            className="p-1 hover:bg-slate-700/50 rounded transition-colors"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-xs text-slate-400 mb-4">
            巡检照片与导入数据存在不一致，系统不自动判定，请根据两方证据决定处理方式。
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Camera size={14} />
                <span className="text-xs font-semibold">照片说法</span>
              </div>
              {photoEvidence.map((e) => (
                <div key={e.id} className="space-y-2">
                  <p className="text-sm text-slate-200">{e.description}</p>
                  <p className="text-xs text-slate-400">证据: {e.evidence}</p>
                  <div className="rounded bg-slate-800/50 p-2 flex items-start gap-2">
                    <ArrowRight size={12} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-300">{e.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-400">
                <FileText size={14} />
                <span className="text-xs font-semibold">数据说法</span>
              </div>
              {dataEvidence.map((e) => (
                <div key={e.id} className="space-y-2">
                  <p className="text-sm text-slate-200">{e.description}</p>
                  <p className="text-xs text-slate-400">证据: {e.evidence}</p>
                  <div className="rounded bg-slate-800/50 p-2 flex items-start gap-2">
                    <ArrowRight size={12} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-300">{e.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between">
          <p className="text-[10px] text-slate-500">系统不会自动选择任何一方</p>
          <button
            onClick={closeConflictPanel}
            className="px-4 py-1.5 text-xs bg-slate-700/50 text-slate-300 rounded hover:bg-slate-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
