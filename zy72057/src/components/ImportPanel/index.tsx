import { useState, useCallback } from "react"
import { useSchemeStore } from "@/store/useSchemeStore"
import { useUIStore } from "@/store/useUIStore"
import { parseImportData, mapCSVToBuildings, mapCSVToPanels, mapCSVToInverters, detectConflicts } from "@/utils/importParser"
import { Upload, FileUp, X, AlertTriangle } from "lucide-react"
import type { Building, SolarPanel, Inverter } from "@/types"

export default function ImportPanel() {
  const { currentScheme, setConflictsAndPending, applyImportedData } = useSchemeStore()
  const { setImportModalOpen } = useUIStore()
  const [rawText, setRawText] = useState("")
  const [format, setFormat] = useState<"csv" | "json">("csv")
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [importType, setImportType] = useState<"building" | "panel" | "inverter">("building")
  const [dragOver, setDragOver] = useState(false)

  const handleParse = useCallback(() => {
    const rows = parseImportData(rawText, format)
    setPreview(rows)
  }, [rawText, format])

  const handleImport = useCallback(() => {
    const rows = parseImportData(rawText, format) as Record<string, string>[]
    if (rows.length === 0) return

    const pending = { buildings: [] as Building[], panels: [] as SolarPanel[], inverters: [] as Inverter[] }

    if (importType === "building") {
      const buildings = mapCSVToBuildings(rows).map((b) => ({
        ...b,
        status: "normal" as const,
        anomalyNote: "",
      } as Building))
      pending.buildings = buildings
      const conflicts = detectConflicts(currentScheme, { buildings })
      if (conflicts.length > 0) {
        setConflictsAndPending(conflicts, pending)
      } else {
        setConflictsAndPending([], pending)
        applyImportedData()
      }
    } else if (importType === "panel") {
      const panels = mapCSVToPanels(rows).map((p) => ({
        ...p,
        status: "normal" as const,
        anomalyNote: "",
        shadowCoverage: 0,
      } as SolarPanel))
      pending.panels = panels
      const conflicts = detectConflicts(currentScheme, { panels })
      if (conflicts.length > 0) {
        setConflictsAndPending(conflicts, pending)
      } else {
        setConflictsAndPending([], pending)
        applyImportedData()
      }
    } else {
      const inverters = mapCSVToInverters(rows).map((i) => ({
        ...i,
        status: "normal" as const,
        anomalyNote: "",
      } as Inverter))
      pending.inverters = inverters
      const conflicts = detectConflicts(currentScheme, { inverters })
      if (conflicts.length > 0) {
        setConflictsAndPending(conflicts, pending)
      } else {
        setConflictsAndPending([], pending)
        applyImportedData()
      }
    }

    setRawText("")
    setPreview([])
    setImportModalOpen(false)
  }, [rawText, format, importType, currentScheme, setConflictsAndPending, applyImportedData, setImportModalOpen])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext === "json") setFormat("json")
    else setFormat("csv")
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRawText(text)
    }
    reader.readAsText(file)
  }, [])

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setImportModalOpen(false)}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2 text-amber-400">
            <Upload size={18} />
            <span className="font-semibold">导入数据</span>
          </div>
          <button onClick={() => setImportModalOpen(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="flex gap-3">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "csv" | "json")}
              className="bg-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-600"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as "building" | "panel" | "inverter")}
              className="bg-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-600"
            >
              <option value="building">建筑</option>
              <option value="panel">光伏板</option>
              <option value="inverter">逆变器</option>
            </select>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver ? "border-amber-500 bg-amber-500/10" : "border-slate-600 hover:border-slate-500"
            }`}
          >
            <FileUp size={28} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-400">拖拽文件到此处，或在下方粘贴内容</p>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={format === "csv" ? "name,x,y,width,depth,height,floor" : '[{"name":"建筑1","x":10,"y":20}]'}
            className="w-full h-32 bg-slate-900 text-slate-200 text-sm font-mono rounded px-3 py-2 border border-slate-600 focus:outline-none focus:border-amber-500 resize-none"
          />

          <div className="flex gap-3">
            <button
              onClick={handleParse}
              disabled={!rawText.trim()}
              className="px-4 py-1.5 bg-slate-700 text-slate-200 text-sm rounded hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              预览解析结果
            </button>
          </div>

          {preview.length > 0 && (
            <div className="bg-slate-900 rounded p-3 max-h-40 overflow-auto">
              <p className="text-xs text-slate-400 mb-2">解析到 {preview.length} 条记录</p>
              <pre className="text-xs text-slate-300 font-mono">
                {JSON.stringify(preview.slice(0, 3), null, 2)}
                {preview.length > 3 && "\n..."}
              </pre>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/5 rounded p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>如果导入数据和现有记录冲突（坐标偏移、同名异写等），会弹窗让你对比确认，不会自动覆盖。</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-700">
          <button
            onClick={() => setImportModalOpen(false)}
            className="px-4 py-1.5 text-slate-400 text-sm hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!rawText.trim()}
            className="px-4 py-1.5 bg-amber-500 text-slate-900 text-sm font-semibold rounded hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  )
}
