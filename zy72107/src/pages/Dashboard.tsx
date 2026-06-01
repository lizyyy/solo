import { useEffect } from "react"
import { useDataStore } from "@/store/useDataStore"
import DataImport from "@/components/data/DataImport"
import DataTable from "@/components/data/DataTable"
import ConflictCard from "@/components/data/ConflictCard"
import SuggestionList from "@/components/data/SuggestionList"
import { Database, AlertTriangle, AlertCircle, Flame } from "lucide-react"

export default function Dashboard() {
  const { records, isLoaded, loadData } = useDataStore()

  useEffect(() => {
    if (!isLoaded) loadData()
  }, [isLoaded, loadData])

  const totalRecords = records.length
  const issuesCount = records.reduce(
    (sum, r) => sum + r.dataQualityFlags.filter((f) => f.status === "pending").length,
    0
  )
  const conflictsCount = records.filter((r) => r.conflictWithNote).length
  const thresholdExceededCount = records.reduce(
    (sum, r) => sum + r.dataQualityFlags.filter((f) => f.type === "threshold_exceeded").length,
    0
  )

  const conflictRecords = records.filter((r) => r.conflictWithNote)

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <DataImport />

      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <Database className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">总记录数</p>
            <p className="text-lg font-semibold text-zinc-900">{totalRecords}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">待处理问题</p>
            <p className="text-lg font-semibold text-zinc-900">{issuesCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">冲突记录</p>
            <p className="text-lg font-semibold text-zinc-900">{conflictsCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
            <Flame className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">超限记录</p>
            <p className="text-lg font-semibold text-zinc-900">{thresholdExceededCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-5">
        <DataTable />
        <SuggestionList />
      </div>

      {conflictRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-900">冲突记录</h2>
          <div className="grid grid-cols-2 gap-4">
            {conflictRecords.map((record) => (
              <ConflictCard key={record.id} record={record} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
