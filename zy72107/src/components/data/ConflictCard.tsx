import { useDataStore } from "@/store/useDataStore"
import type { ExperimentRecord } from "@/types"

export default function ConflictCard({ record }: { record: ExperimentRecord }) {
  const { resolveConflict } = useDataStore()

  if (!record.conflictWithNote || !record.conflictDetail) return null

  const { noteSays, dataSays, suggestedActions } = record.conflictDetail

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-amber-900">
        ⚠ 冲突记录 — {record.timestamp}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-amber-200 bg-white p-3">
          <p className="mb-1 text-xs font-medium text-amber-600">实验备注说</p>
          <p className="text-sm text-zinc-800">{noteSays}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-white p-3">
          <p className="mb-1 text-xs font-medium text-amber-600">导入数据显示</p>
          <p className="text-sm text-zinc-800">{dataSays}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestedActions.map((action) => (
          <button
            key={action.label}
            onClick={() => resolveConflict(record.id, action.label)}
            className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
            title={action.description}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
