import { useState, useMemo } from 'react'
import { useMaterialStore } from '@/store/materialStore'
import { useScreeningStore } from '@/store/screeningStore'
import { calculateScore } from '@/utils/scoring'
import { exportAsPDF, exportAsJSON } from '@/utils/export'
import { ScoreBreakdown } from '@/types'
import RadarComparison from '@/components/RadarComparison'
import BarComparison from '@/components/BarComparison'
import ScoreDetailPanel from '@/components/ScoreDetailPanel'
import ReportPreview from '@/components/ReportPreview'

export default function ReportPage() {
  const materials = useMaterialStore((s) => s.materials)
  const { weightConfig, roomConfig, combinations, selectedBreakdown } = useScreeningStore()

  const [selectedIds, setSelectedIds] = useState<string[]>(materials.slice(0, 2).map((m) => m.id))
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [detailBreakdown, setDetailBreakdown] = useState<ScoreBreakdown | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const scores = useMemo(
    () => materials.map((m) => calculateScore(m, weightConfig)),
    [materials, weightConfig],
  )

  const handleBarClick = (materialId: string, _band: string) => {
    const breakdown = scores.find((s) => s.materialId === materialId) ?? null
    setDetailBreakdown(breakdown)
    setIsDetailOpen(true)
  }

  const handleCloseDetail = () => {
    setIsDetailOpen(false)
    setDetailBreakdown(null)
  }

  const handleExportPDF = () => exportAsPDF(materials, weightConfig, roomConfig, combinations, scores)
  const handleExportJSON = () => exportAsJSON(materials, weightConfig, roomConfig, combinations, scores)

  return (
    <div className="min-h-screen bg-[#1a2f2a] text-gray-100">
      <div className="flex items-center justify-between p-6 border-b border-[#2d4a3f]">
        <h1 className="text-2xl font-bold text-[#e8a838]">对比报告</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="px-4 py-2 bg-[#e8a838] text-[#1a2f2a] font-semibold rounded-lg hover:bg-[#d49530]"
          >
            预览报告
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-[#2d4a3f] text-gray-200 rounded-lg hover:bg-[#3d5a4f]"
          >
            导出PDF
          </button>
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 bg-[#2d4a3f] text-gray-200 rounded-lg hover:bg-[#3d5a4f]"
          >
            导出JSON
          </button>
        </div>
      </div>

      <div className="flex p-6 gap-6">
        <div className="w-2/3 space-y-6">
          <RadarComparison
            materials={materials}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
          <BarComparison
            scores={scores}
            weightConfig={weightConfig}
            onBarClick={handleBarClick}
          />
        </div>
        <div className="w-1/3" />
      </div>

      <ScoreDetailPanel
        breakdown={detailBreakdown ?? selectedBreakdown}
        isOpen={isDetailOpen || !!selectedBreakdown}
        onClose={handleCloseDetail}
      />
      <ReportPreview isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} />
    </div>
  )
}
