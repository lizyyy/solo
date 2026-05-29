import { useState } from "react"
import { useExperimentStore } from "@/store/useExperimentStore"
import { exportCSV, exportJSON, downloadFile } from "@/utils/importExport"
import { ANOMALY_LABELS, STATUS_LABELS, SENSITIVE_FIELDS } from "@/types"
import { Download, FileText, FileJson, Trash2, Lock } from "lucide-react"

export default function DataTable() {
  const filteredRecords = useExperimentStore((s) => s.filteredRecords())
  const deleteRecord = useExperimentStore((s) => s.deleteRecord)
  const clearRecords = useExperimentStore((s) => s.clearRecords)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const handleExport = (fmt: "csv" | "json") => {
    const records = filteredRecords
    if (records.length === 0) return

    if (fmt === "csv") {
      const content = exportCSV(records)
      downloadFile(content, `maglev_export_${Date.now()}.csv`, "text/csv;charset=utf-8")
    } else {
      const content = exportJSON(records)
      downloadFile(content, `maglev_export_${Date.now()}.json`, "application/json")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[#00E5CC] font-semibold text-sm tracking-wider uppercase">
          实验记录 ({filteredRecords.length})
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1628] border border-[#1A3A5C] rounded text-xs text-[#8899AA] hover:border-[#00E5CC]/30 hover:text-[#00E5CC] transition-all"
          >
            <FileText size={12} />
            CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1628] border border-[#1A3A5C] rounded text-xs text-[#8899AA] hover:border-[#00E5CC]/30 hover:text-[#00E5CC] transition-all"
          >
            <FileJson size={12} />
            JSON
          </button>
          <button
            onClick={clearRecords}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1628] border border-red-900/30 rounded text-xs text-red-400/60 hover:border-red-500/50 hover:text-red-400 transition-all"
          >
            <Trash2 size={12} />
            清空
          </button>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="text-center py-12 text-[#445566] text-sm">
          暂无实验记录，请先在控制台运行实验或导入数据
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1A3A5C]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0D1F3C]">
                {["间距", "质量", "轨道", "电流", "扰动", "状态", "F/G", "异常", "备注", "报告", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[#8899AA] font-medium whitespace-nowrap">
                    {h === "报告" ? (
                      <span className="flex items-center gap-1">
                        <Lock size={10} />
                        {h}
                      </span>
                    ) : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const isAnomaly = !!record.result.anomalyType
                const isHovered = hoveredRow === record.id

                return (
                  <tr
                    key={record.id}
                    onMouseEnter={() => setHoveredRow(record.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    className={`border-t border-[#1A3A5C]/50 transition-colors
                      ${isAnomaly ? "bg-red-900/10" : "bg-[#0A1628]"}
                      ${isHovered ? "bg-[#1A3A5C]/20" : ""}`}
                  >
                    <td className="px-3 py-2 text-white font-mono">{record.magnetSpacing}</td>
                    <td className="px-3 py-2 text-white font-mono">{record.vehicleMass}</td>
                    <td className="px-3 py-2 text-white font-mono">{record.trackLength}</td>
                    <td className="px-3 py-2 text-white font-mono">{record.current}</td>
                    <td className="px-3 py-2 text-white font-mono">{record.disturbance}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={record.result.status} />
                    </td>
                    <td className="px-3 py-2 text-white font-mono">{record.result.ratio.toFixed(4)}</td>
                    <td className="px-3 py-2">
                      {record.result.anomalyType ? (
                        <span className="text-red-400 text-[10px]">
                          {ANOMALY_LABELS[record.result.anomalyType]}
                        </span>
                      ) : (
                        <span className="text-[#445566]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[#8899AA] max-w-[120px] truncate" title={record.manualNote}>
                      {record.manualNote || "-"}
                    </td>
                    <td className="px-3 py-2">
                      {record.stabilityReport ? (
                        <span className="text-[10px] text-[#556677] flex items-center gap-1">
                          <Lock size={8} />
                          已脱敏
                        </span>
                      ) : (
                        <span className="text-[#445566]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => deleteRecord(record.id)}
                        className="text-[#445566] hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    stable: { color: "text-[#00E5CC] bg-[#00E5CC]/10 border-[#00E5CC]/30", label: STATUS_LABELS.stable },
    critical: { color: "text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/30", label: STATUS_LABELS.critical },
    unstable: { color: "text-[#FF4444] bg-[#FF4444]/10 border-[#FF4444]/30", label: STATUS_LABELS.unstable },
  }
  const c = cfg[status] || cfg.unstable
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${c.color}`}>
      {c.label}
    </span>
  )
}
