import { useEffect } from "react"
import { Activity } from "lucide-react"
import FilterPanel from "@/components/FilterPanel"
import HeatmapCanvas from "@/components/HeatmapCanvas"
import Timeline from "@/components/Timeline"
import DetailPanel from "@/components/DetailPanel"
import AuditLogPanel from "@/components/AuditLogPanel"
import ExportButton from "@/components/ExportButton"
import { useAppStore } from "@/store/useAppStore"
import { detectQualityIssues } from "@/utils/qualityDetector"

export default function Home() {
  const { points, addAuditLog } = useAppStore()

  useEffect(() => {
    const issues = detectQualityIssues(points)
    if (issues.length > 0) {
      addAuditLog("annotate", `数据加载完成，自动检测到 ${issues.length} 个潜在数据质量问题`)
    } else {
      addAuditLog("annotate", "数据加载完成，未检测到质量问题")
    }
  }, [])

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col bg-[#0D1117] overflow-hidden">
      <header className="h-12 shrink-0 bg-[#1A1A2E]/90 border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#E94560] to-[#F0A500] flex items-center justify-center">
            <Activity size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">地铁站厅拥堵热力图</h1>
            <p className="text-[10px] text-white/40">运维数据核对工具 · 何工专用</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-white/40 px-2 py-1 bg-white/5 rounded">
            数据版本: 2026-06-01
          </div>
          <ExportButton />
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <FilterPanel />
        <HeatmapCanvas />
        <DetailPanel />
      </div>

      <Timeline />
      <AuditLogPanel />
    </div>
  )
}
