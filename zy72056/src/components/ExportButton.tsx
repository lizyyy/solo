import { useRef, useState } from "react"
import { Camera, Download, Loader2 } from "lucide-react"
import html2canvas from "html2canvas"
import { useAppStore } from "@/store/useAppStore"
import { renderWatermark } from "@/utils/watermarkRenderer"

export default function ExportButton() {
  const { filter, addAuditLog } = useAppStore()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    const container = document.getElementById("app-container")
    if (!container) return

    setExporting(true)

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: "#0D1117",
        scale: 2,
        useCORS: true,
        logging: false,
      })

      const timestamp = new Date().toLocaleString("zh-CN")
      renderWatermark(canvas, filter, timestamp)

      const link = document.createElement("a")
      link.download = `地铁站厅拥堵热力图_${filter.timeHour}点_${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()

      addAuditLog("export", `导出截图 - 时段${filter.timeHour}:00, 楼层${filter.floors.join(",")}`, undefined, {
        filter: JSON.parse(JSON.stringify(filter)),
        timestamp,
      })
    } catch (err) {
      console.error("导出失败:", err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-3 py-2 bg-[#1A1A2E]/80 border border-white/10 rounded-lg text-white/80 hover:text-white hover:bg-[#1A1A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="导出当前视图（带筛选条件水印）"
    >
      {exporting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Camera size={16} />
      )}
      <span className="text-sm">导出截图</span>
      <Download size={14} className="opacity-60" />
    </button>
  )
}
