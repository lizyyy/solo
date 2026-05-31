import { ChevronRight, FileSpreadsheet, MessageSquareQuote, Settings2 } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"
import { SOURCE_LABELS } from "@/types"
import type { DataSourceType } from "@/types"

const sourceMeta: { type: DataSourceType; icon: typeof FileSpreadsheet; color: string }[] = [
  { type: "evaluation", icon: FileSpreadsheet, color: "text-amber-400" },
  { type: "online_feedback", icon: MessageSquareQuote, color: "text-sky-400" },
  { type: "config", icon: Settings2, color: "text-emerald-400" },
]

export default function PipelineView() {
  const selectedExperimentId = useAppStore((s) => s.selectedExperimentId)
  const getExperimentDataSources = useAppStore((s) => s.getExperimentDataSources)

  const dataSources = selectedExperimentId
    ? getExperimentDataSources(selectedExperimentId)
    : []

  return (
    <div className="rounded-md bg-slate-800/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">数据流水线</h3>

      <div className="flex items-stretch gap-0">
        {sourceMeta.map((meta, idx) => {
          const items = dataSources.filter((ds) => ds.type === meta.type && !ds.rolledBack)
          const Icon = meta.icon

          return (
            <div key={meta.type} className="flex items-stretch">
              <div
                className={cn(
                  "flex min-w-[180px] flex-1 flex-col rounded-md border border-slate-700 bg-slate-900/70 p-3",
                  !selectedExperimentId && "opacity-40"
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", meta.color)} />
                  <span className="text-sm font-medium text-slate-200">
                    {SOURCE_LABELS[meta.type]}
                  </span>
                  <span className="ml-auto rounded bg-slate-700/80 px-1.5 py-0.5 text-xs text-slate-400">
                    {items.length}
                  </span>
                </div>

                <div className="flex-1 space-y-1">
                  {items.length === 0 && (
                    <p className="text-xs text-slate-500 italic">暂无数据</p>
                  )}
                  {items.map((ds) => (
                    <div
                      key={ds.id}
                      className="truncate rounded bg-slate-800 px-2 py-1 text-xs font-mono text-slate-300"
                      title={ds.fileName}
                    >
                      {ds.fileName}
                    </div>
                  ))}
                </div>

                {items.length > 0 && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    导入：{items[items.length - 1].importedAt}
                  </p>
                )}
              </div>

              {idx < sourceMeta.length - 1 && (
                <div className="flex items-center px-2">
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!selectedExperimentId && (
        <p className="mt-3 text-center text-xs text-slate-500">请先选择实验查看数据流水线</p>
      )}
    </div>
  )
}
