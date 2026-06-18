import { useState } from 'react'
import { Download, Check } from 'lucide-react'
import { useWaterQualityStore } from '@/store'
import { exportToCSV } from '@/utils'

export default function CsvExport() {
  const [exported, setExported] = useState(false)
  const records = useWaterQualityStore((s) => s.records)
  const dataSources = useWaterQualityStore((s) => s.dataSources)
  const changes = useWaterQualityStore((s) => s.changes)
  const reviews = useWaterQualityStore((s) => s.reviews)
  const handovers = useWaterQualityStore((s) => s.handovers)

  const handleExport = () => {
    exportToCSV(records, dataSources, changes, reviews, handovers)
    setExported(true)
    setTimeout(() => setExported(false), 2500)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 rounded-lg bg-ocean-700 px-5 py-2.5 text-sm font-sans text-foam transition-colors hover:bg-ocean-600"
    >
      {exported ? (
        <>
          <Check size={16} className="text-tide" />
          <span className="text-tide">导出成功</span>
        </>
      ) : (
        <>
          <Download size={16} />
          <span>导出 CSV</span>
        </>
      )}
    </button>
  )
}
