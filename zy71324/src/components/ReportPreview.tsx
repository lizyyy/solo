import { useMaterialStore } from '@/store/materialStore'
import { useScreeningStore } from '@/store/screeningStore'
import { calculateScore } from '@/utils/scoring'
import { generateReportText, exportAsPDF, exportAsJSON } from '@/utils/export'
import { X } from 'lucide-react'

interface ReportPreviewProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReportPreview({ isOpen, onClose }: ReportPreviewProps) {
  const materials = useMaterialStore((s) => s.materials)
  const { weightConfig, roomConfig, combinations } = useScreeningStore()

  if (!isOpen) return null

  const scores = materials.map((m) => calculateScore(m, weightConfig))
  const reportText = generateReportText(materials, weightConfig, roomConfig, combinations, scores)

  const handlePDF = () => exportAsPDF(materials, weightConfig, roomConfig, combinations, scores)
  const handleJSON = () => exportAsJSON(materials, weightConfig, roomConfig, combinations, scores)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#0f1f1a] rounded-xl border border-[#2d4a3f] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#2d4a3f]">
          <h2 className="text-xl font-semibold text-[#e8a838]">筛选报告预览</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono leading-relaxed">
            {reportText}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#2d4a3f]">
          <button
            onClick={handlePDF}
            className="px-4 py-2 bg-[#e8a838] text-[#1a2f2a] font-semibold rounded-lg hover:bg-[#d49530]"
          >
            导出PDF
          </button>
          <button
            onClick={handleJSON}
            className="px-4 py-2 bg-[#2d4a3f] text-gray-200 rounded-lg hover:bg-[#3d5a4f]"
          >
            导出JSON
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-transparent border border-gray-600 text-gray-400 rounded-lg hover:text-white hover:border-gray-400"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
