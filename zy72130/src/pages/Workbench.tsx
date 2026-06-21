import { useEffect } from 'react'
import { Download } from 'lucide-react'
import { useStore } from '@/store/useStore'
import ImportZone from '@/components/ImportZone'
import FilterPanel from '@/components/FilterPanel'
import RecordTable from '@/components/RecordTable'

export default function Workbench() {
  const { fetchRecords, filter } = useStore()

  useEffect(() => {
    fetchRecords()
  }, [])

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filter.status) params.set('status', filter.status)
    if (filter.source) params.set('source', filter.source)
    if (filter.dateFrom) params.set('dateFrom', filter.dateFrom)
    if (filter.dateTo) params.set('dateTo', filter.dateTo)
    if (filter.sortBy) params.set('sortBy', filter.sortBy)
    if (filter.sortOrder) params.set('sortOrder', filter.sortOrder)
    window.open(`/api/export?${params.toString()}`, '_blank')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <aside className="space-y-4">
        <FilterPanel />
        <ImportZone />
      </aside>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">分账记录</h2>
          <button onClick={handleExport} className="btn-primary flex items-center gap-2 text-xs">
            <Download className="h-3.5 w-3.5" />
            导出清单
          </button>
        </div>
        <RecordTable />
      </section>
    </div>
  )
}
