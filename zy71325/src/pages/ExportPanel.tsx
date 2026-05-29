import { useState } from "react"
import { useStore } from "@/store"
import { formatDateTime, generateId } from "@/utils/hash"
import { exportAsJSON, exportAsPDF, downloadJSON, downloadPDF, computeExportHash } from "@/utils/export"
import { FileDown, FileJson, FileText, AlertTriangle, SkipForward, RefreshCw, Plus } from "lucide-react"
import type { ConflictStrategy } from "@/types"
import ConflictModal from "@/components/ConflictModal"

export default function ExportPanel() {
  const { currentSessionId, versions, tracks, exports: exportRecords, exportVersion } = useStore()
  const [selectedVersionId, setSelectedVersionId] = useState("")
  const [format, setFormat] = useState<"pdf" | "json">("json")
  const [isExporting, setIsExporting] = useState(false)
  const [conflict, setConflict] = useState<{
    open: boolean
    versionId: string
    fmt: "pdf" | "json"
    existingTime: string
  }>({ open: false, versionId: "", fmt: "json", existingTime: "" })

  const handleExport = async (strategy?: ConflictStrategy) => {
    if (!selectedVersionId) return
    const version = versions.find((v) => v.id === selectedVersionId)
    if (!version) return

    const existing = exportRecords.filter(
      (e) => e.versionId === selectedVersionId && e.format === format
    )

    if (existing.length > 0 && !strategy) {
      setConflict({
        open: true,
        versionId: selectedVersionId,
        fmt: format,
        existingTime: existing[0].exportedAt,
      })
      return
    }

    setIsExporting(true)

    try {
      const result = await exportVersion(
        selectedVersionId,
        format,
        strategy || "append"
      )

      if (result === "skip") {
        setIsExporting(false)
        setConflict({ open: false, versionId: "", fmt: "json", existingTime: "" })
        return
      }

      const trackInfos = tracks.map((t) => ({
        id: t.id,
        fileName: t.fileName,
        channelType: t.channelType,
      }))

      if (format === "json" && result) {
        downloadJSON(result, `rehearsal-report-${selectedVersionId.slice(0, 6)}.json`)
      } else if (format === "pdf") {
        const doc = exportAsPDF(version, trackInfos)
        downloadPDF(doc, `rehearsal-report-${selectedVersionId.slice(0, 6)}.pdf`)
      }
    } finally {
      setIsExporting(false)
      setConflict({ open: false, versionId: "", fmt: "json", existingTime: "" })
    }
  }

  if (!currentSessionId) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <FileDown size={40} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-base text-gray-400">请先在导入工作台创建或选择排练场次</h3>
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <FileDown size={40} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-base text-gray-400">暂无可导出的版本</h3>
        <p className="text-sm text-gray-600 mt-2">请先在对齐检测和片段标注后保存版本</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {conflict.open && (
        <ConflictModal
          fileName={`${format.toUpperCase()} 报告`}
          existingFile={`已导出于 ${formatDateTime(conflict.existingTime)}`}
          onResolve={(strategy) => handleExport(strategy)}
          onCancel={() => setConflict({ open: false, versionId: "", fmt: "json", existingTime: "" })}
        />
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-100">报告导出</h1>
        <p className="text-sm text-gray-500 mt-1">选择版本和格式，导出整理报告</p>
      </div>

      <div className="bg-[#12122A] border border-[#2A2A4A] rounded-xl p-6 mb-6">
        <h3 className="text-sm font-bold text-gray-300 mb-4">导出配置</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">选择版本</label>
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="w-full bg-[#0F0F1A] border border-[#2A2A4A] rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">请选择版本...</option>
              {versions.map((v, i) => (
                <option key={v.id} value={v.id}>
                  v{(versions.length - i).toString().padStart(3, "0")} - {v.summary.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">导出格式</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat("json")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  format === "json"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-[#0F0F1A] text-gray-500 border border-[#2A2A4A] hover:text-gray-300"
                }`}
              >
                <FileJson size={16} />
                JSON
              </button>
              <button
                onClick={() => setFormat("pdf")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  format === "pdf"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-[#0F0F1A] text-gray-500 border border-[#2A2A4A] hover:text-gray-300"
                }`}
              >
                <FileText size={16} />
                PDF
              </button>
            </div>
          </div>

          {selectedVersionId && (
            <div className="bg-[#0F0F1A] rounded-lg p-3">
              <h4 className="text-xs text-gray-500 mb-2">版本预览</h4>
              {(() => {
                const v = versions.find((ver) => ver.id === selectedVersionId)
                if (!v) return null
                return (
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>摘要: <span className="text-gray-300">{v.summary}</span></p>
                    <p>创建时间: <span className="text-gray-300">{formatDateTime(v.createdAt)}</span></p>
                    <p>轨道数: <span className="text-gray-300">{v.trackStates.length}</span></p>
                    <p>异常数: <span className="text-gray-300">{v.anomalies.length}</span> (已处理 {v.anomalies.filter((a) => a.resolved).length})</p>
                  </div>
                )
              })()}
            </div>
          )}

          <button
            onClick={() => handleExport()}
            disabled={!selectedVersionId || isExporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <FileDown size={16} />
                导出 {format.toUpperCase()} 报告
              </>
            )}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-300 mb-3">导出历史</h3>
        {exportRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">暂无导出记录</div>
        ) : (
          <div className="bg-[#12122A] border border-[#2A2A4A] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A4A]">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">版本</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">格式</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">导出时间</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">摘要</th>
                </tr>
              </thead>
              <tbody>
                {exportRecords.map((record) => (
                  <tr key={record.id} className="border-b border-[#2A2A4A]/50 hover:bg-[#1A1A35]">
                    <td className="px-4 py-3 text-sm text-gray-300 font-mono">
                      {record.versionId.slice(0, 6)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          record.format === "pdf"
                            ? "bg-blue-400/10 text-blue-400"
                            : "bg-amber-400/10 text-amber-400"
                        }`}
                      >
                        {record.format.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDateTime(record.exportedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {record.contentSummary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
