import { useMemo } from 'react'
import StatusCards from '@/components/StatusCards'
import FilterBar from '@/components/FilterBar'
import RecordList from '@/components/RecordList'
import { useInspectionStore } from '@/store/inspectionStore'
import { BarChart3 } from 'lucide-react'

export default function Dashboard() {
  const records = useInspectionStore((s) => s.records)

  const summary = useMemo(() => {
    const autoJudged = records.filter((r) => r.status === 'confirmed' && r.confirmedAt).length
    const pendingManual = records.filter((r) => r.status !== 'confirmed').length
    return { total: records.length, autoJudged, pendingManual }
  }, [records])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-indigo-950" />
          <h2 className="text-2xl font-bold text-indigo-950">巡检仪表盘</h2>
        </div>
        <div className="text-sm text-slate-500">
          本轮共 <span className="font-semibold text-indigo-950">{summary.total}</span> 条记录，
          自动判断 <span className="font-semibold text-emerald-600">{summary.autoJudged}</span> 条，
          待人工确认 <span className="font-semibold text-amber-600">{summary.pendingManual}</span> 条
        </div>
      </div>

      <StatusCards />

      <div className="mt-6">
        <FilterBar />
      </div>

      <div className="mt-4">
        <RecordList />
      </div>
    </div>
  )
}
