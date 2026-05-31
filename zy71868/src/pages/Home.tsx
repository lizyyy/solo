import { useState, useMemo } from "react"
import { Plus, FileDown, ScrollText } from "lucide-react"
import { useGradingStore } from "@/store/gradingStore"
import type { RecordStatus, ChangeType, Source } from "@/types"
import { StatsBar } from "@/components/StatsBar"
import { FilterBar } from "@/components/FilterBar"
import { RecordCard } from "@/components/RecordCard"
import { AddRecordModal } from "@/components/AddRecordModal"
import { ExportModal } from "@/components/ExportModal"
import { UserSelector } from "@/components/UserSelector"

export default function Home() {
  const records = useGradingStore((s) => s.records)

  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all")
  const [sourceFilter, setSourceFilter] = useState<Source | "all">("all")
  const [changeTypeFilter, setChangeTypeFilter] = useState<
    ChangeType | "all"
  >("all")
  const [addOpen, setAddOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false
      if (changeTypeFilter !== "all" && r.changeType !== changeTypeFilter)
        return false
      return true
    })
  }, [records, statusFilter, sourceFilter, changeTypeFilter])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-navy-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <ScrollText size={22} className="text-amber-400" />
            <h1 className="font-serif text-lg font-bold text-white">
              集合关系批改
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <UserSelector />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-5">
        <StatsBar />

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-navy-800">筛选</h2>
          </div>
          <FilterBar
            statusFilter={statusFilter}
            sourceFilter={sourceFilter}
            changeTypeFilter={changeTypeFilter}
            onStatusChange={setStatusFilter}
            onSourceChange={setSourceFilter}
            onChangeTypeChange={setChangeTypeFilter}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            共 {filtered.length} 条记录
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-navy-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700"
            >
              <Plus size={14} />
              新增
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
            >
              <FileDown size={14} />
              导出讲评稿
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((r, i) => (
            <div
              key={r.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <RecordCard record={r} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              暂无匹配记录
            </div>
          )}
        </div>
      </main>

      <AddRecordModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
