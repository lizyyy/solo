import { useMemo } from "react"
import { useSchemeStore } from "@/store/useSchemeStore"
import { useUIStore } from "@/store/useUIStore"
import { generateReport } from "@/utils/reportGenerator"
import { STATUS_LABELS } from "@/types"
import type { ItemStatus } from "@/types"
import { X, Download, FileText } from "lucide-react"
import html2canvas from "html2canvas"

export default function ReportPreview() {
  const { currentScheme } = useSchemeStore()
  const { filterStatus, toggleReport } = useUIStore()

  const report = useMemo(
    () => generateReport(currentScheme, filterStatus),
    [currentScheme, filterStatus]
  )

  const handleExport = async () => {
    const el = document.getElementById("report-content")
    if (!el) return
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#0f172a",
        scale: 2,
        useCORS: true,
        allowTaint: true,
      })
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "rgba(248,250,252,0.85)"
        ctx.font = "bold 14px 'DM Sans', sans-serif"
        const filterLabel = filterStatus === "all" ? "无筛选" : STATUS_LABELS[filterStatus as ItemStatus] || filterStatus
        ctx.fillText(`筛选条件: ${filterLabel}`, 20, 30)

        ctx.font = "12px 'DM Sans', sans-serif"
        const timeStr = new Date().toLocaleString("zh-CN")
        const rightText = `${currentScheme.name} | ${timeStr}`
        const rightTextWidth = ctx.measureText(rightText).width
        ctx.fillText(rightText, canvas.width - rightTextWidth - 20, canvas.height - 20)
        ctx.fillText("光伏园区阴影模型 v1.0", 20, canvas.height - 20)
      }
      const link = document.createElement("a")
      link.download = `${currentScheme.name}-报告.png`
      link.href = canvas.toDataURL("image/png")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error("导出失败", err)
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-slate-900 border-l border-slate-700 z-40 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2 text-amber-400">
          <FileText size={18} />
          <span className="font-semibold text-sm">阴影分析报告</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-amber-400"
            title="导出报告截图"
          >
            <Download size={16} />
          </button>
          <button
            onClick={toggleReport}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div
        id="report-content"
        className="flex-1 overflow-y-auto p-4 text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed"
      >
        {report}
      </div>
      <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
        报告随参数自动更新，导出截图会带上筛选条件
      </div>
    </div>
  )
}
