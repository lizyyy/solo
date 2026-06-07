import { useEffect, useRef } from "react"
import { Activity, RotateCcw } from "lucide-react"
import FilterPanel from "@/components/FilterPanel"
import HeatmapCanvas from "@/components/HeatmapCanvas"
import Timeline from "@/components/Timeline"
import DetailPanel from "@/components/DetailPanel"
import AuditLogPanel from "@/components/AuditLogPanel"
import ExportButton from "@/components/ExportButton"
import { useAppStore } from "@/store/useAppStore"
import { detectQualityIssues } from "@/utils/qualityDetector"

export default function Home() {
  const { points, addAuditLog, hasPersistedData, resetAllData } = useAppStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    if (hasPersistedData) {
      addAuditLog("annotate", "检测到本地缓存数据，已加载上次保存的操作记录")
    } else {
      const issues = detectQualityIssues(points)
      if (issues.length > 0) {
        addAuditLog("annotate", `数据加载完成，自动检测到 ${issues.length} 个潜在数据质量问题`)
      } else {
        addAuditLog("annotate", "数据加载完成，未检测到质量问题")
      }
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
          {hasPersistedData && (
            <div className="text-xs text-yellow-400/80 px-2 py-1 bg-yellow-500/10 rounded border border-yellow-500/20">
              已缓存 {points.length} 点位数据
            </div>
          )}
          <button
            onClick={resetAllData}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/60 hover:text-white transition-colors text-xs"
            title="重置所有数据为初始状态"
          >
            <RotateCcw size={14} />
            重置
          </button>
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
