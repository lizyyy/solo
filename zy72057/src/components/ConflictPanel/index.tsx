import { useSchemeStore } from "@/store/useSchemeStore"
import { AlertTriangle, Check, ArrowRightLeft, GitMerge, X } from "lucide-react"
import type { ConflictRecord } from "@/types"

export default function ConflictPanel() {
  const { conflicts, resolveConflict, applyImportedData, cancelImport } = useSchemeStore()

  if (conflicts.length === 0) return null

  const unresolved = conflicts.filter((c) => !c.resolved)
  const resolved = conflicts.filter((c) => c.resolved)

  const typeLabel: Record<string, string> = {
    coordinate_offset: "坐标偏移",
    name_mismatch: "名称不一致",
    missing_field: "字段缺失",
    boundary_cross: "跨楼层",
  }

  const suggestionIcon = (c: ConflictRecord) => {
    if (c.type === "coordinate_offset") return <ArrowRightLeft size={14} className="text-amber-400" />
    if (c.type === "name_mismatch") return <GitMerge size={14} className="text-amber-400" />
    return <AlertTriangle size={14} className="text-amber-400" />
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={cancelImport}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <AlertTriangle size={18} />
            <span>数据冲突检测</span>
            <span className="text-slate-400 font-normal text-sm ml-2">
              {unresolved.length} 条待处理
            </span>
          </div>
          <button onClick={cancelImport} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {unresolved.map((c) => (
            <div key={c.id} className="bg-slate-900 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                {suggestionIcon(c)}
                <span className="text-amber-400 font-medium">{typeLabel[c.type] || c.type}</span>
                <span className="text-slate-400">—</span>
                <span className="text-slate-300">{c.description}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800 rounded p-3">
                  <p className="text-xs text-slate-500 mb-1">现有数据</p>
                  <pre className="text-xs text-slate-300 font-mono">{JSON.stringify(c.existingData, null, 2)}</pre>
                </div>
                <div className="bg-slate-800 rounded p-3">
                  <p className="text-xs text-slate-500 mb-1">导入数据</p>
                  <pre className="text-xs text-slate-300 font-mono">{JSON.stringify(c.importedData, null, 2)}</pre>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 rounded px-3 py-2">
                <AlertTriangle size={12} className="text-amber-400" />
                <span>建议：{c.suggestion}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => resolveConflict(c.id, "keep_existing")}
                  className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                >
                  保留现有
                </button>
                <button
                  onClick={() => resolveConflict(c.id, "use_imported")}
                  className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                >
                  采用导入
                </button>
                <button
                  onClick={() => resolveConflict(c.id, "merge")}
                  className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
                >
                  合并标记
                </button>
              </div>
            </div>
          ))}

          {resolved.map((c) => (
            <div key={c.id} className="bg-slate-900/50 rounded-lg p-3 opacity-60">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Check size={14} className="text-green-500" />
                <span>{c.description}</span>
                <span className="text-xs ml-auto">
                  {c.userDecision === "keep_existing" ? "已保留现有" : c.userDecision === "use_imported" ? "已采用导入" : "已合并"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-700">
          <button
            onClick={cancelImport}
            className="px-4 py-1.5 text-slate-400 text-sm hover:text-white transition-colors"
          >
            取消全部导入
          </button>
          <button
            onClick={applyImportedData}
            disabled={unresolved.length > 0}
            className="px-4 py-1.5 bg-amber-500 text-slate-900 text-sm font-semibold rounded hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            应用决策
          </button>
        </div>
      </div>
    </div>
  )
}
