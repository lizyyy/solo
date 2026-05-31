import { useState } from "react"
import { useStore } from "@/store/useStore"
import type { ImportMode, PVRoute } from "@/types"
import { Upload, Undo2, FileDown, FileUp, CheckCircle, Loader2 } from "lucide-react"

function generateDemoRoute(): PVRoute {
  const id = `r${Date.now().toString(36)}`
  const batteryCycles = Math.floor(Math.random() * 200) + 20
  const expectedCycles = batteryCycles + Math.floor(Math.random() * 10) - 5
  return {
    id,
    name: `新建航线-${id.slice(-4)}`,
    date: new Date().toISOString().split("T")[0],
    status: "normal",
    batteryCycles,
    expectedCycles,
    flightDuration: Math.round((Math.random() * 40 + 10) * 10) / 10,
    returnPointStatus: Math.random() > 0.8 ? "lost" : Math.random() > 0.7 ? "low_altitude" : "ok",
    noFlyZoneDistance: Math.floor(Math.random() * 500) + 10,
    pilot: "张明",
    inspector: "李伟",
    safetyOfficer: "王强",
  }
}

export default function ImportPanel() {
  const [mode, setMode] = useState<ImportMode>("append")
  const [importing, setImporting] = useState(false)
  const [lastImportResult, setLastImportResult] = useState<string | null>(null)
  const importRoutes = useStore((s) => s.importRoutes)
  const undoLastImport = useStore((s) => s.undoLastImport)
  const exportCSV = useStore((s) => s.exportCSV)
  const importHistory = useStore((s) => s.importHistory)

  const handleImport = () => {
    setImporting(true)
    setLastImportResult(null)
    const newRoutes = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => generateDemoRoute())
    setTimeout(() => {
      importRoutes(newRoutes, mode)
      setImporting(false)
      setLastImportResult(`成功导入 ${newRoutes.length} 条航线（${mode === "overwrite" ? "覆盖" : "追加"}模式）`)
    }, 800)
  }

  const handleUndo = () => {
    if (importHistory.length > 0) {
      undoLastImport()
      setLastImportResult("已撤回最近一次导入")
    }
  }

  const handleExport = () => {
    const csv = exportCSV()
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pv-routes-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-surface-700/50 border border-surface-500/20 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Upload size={16} className="text-accent-blue" />
          数据导入 / 导出
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-surface-600 border border-surface-500/30 rounded-lg hover:bg-surface-500 transition-colors"
          >
            <FileDown size={14} />
            导出 CSV
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1.5 block">导入模式</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("append")}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                mode === "append"
                  ? "border-accent-green/50 text-accent-green bg-accent-green/10"
                  : "border-surface-500/30 text-slate-500 hover:text-slate-300"
              }`}
            >
              <FileUp size={12} className="inline mr-1" />
              追加
            </button>
            <button
              onClick={() => setMode("overwrite")}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                mode === "overwrite"
                  ? "border-accent-amber/50 text-accent-amber bg-accent-amber/10"
                  : "border-surface-500/30 text-slate-500 hover:text-slate-300"
              }`}
            >
              <Upload size={12} className="inline mr-1" />
              覆盖
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-white bg-accent-green/80 hover:bg-accent-green rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                导入中...
              </>
            ) : (
              <>
                <FileUp size={14} />
                模拟导入
              </>
            )}
          </button>
          <button
            onClick={handleUndo}
            disabled={importHistory.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-surface-600 border border-surface-500/30 rounded-lg hover:bg-surface-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 size={14} />
            撤回
          </button>
        </div>
      </div>

      {lastImportResult && (
        <div className="flex items-center gap-2 px-3 py-2 bg-accent-green/5 border border-accent-green/20 rounded-lg text-xs text-accent-green animate-fade-in">
          <CheckCircle size={14} />
          {lastImportResult}
        </div>
      )}

      {importHistory.length > 0 && (
        <div className="text-[10px] text-slate-600 font-mono">
          导入历史: {importHistory.length} 次 · 最近: {importHistory[importHistory.length - 1].timestamp.replace("T", " ").slice(0, 16)}
        </div>
      )}
    </div>
  )
}
