import { FlaskConical } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"
import { STATUS_LABELS } from "@/types"
import FilterBar from "@/components/Dashboard/FilterBar"
import PipelineView from "@/components/Dashboard/PipelineView"
import MetricComparison from "@/components/Dashboard/MetricComparison"
import AutoJudgment from "@/components/Dashboard/AutoJudgment"
import CaliberChangeBanner from "@/components/Dashboard/CaliberChangeBanner"

export default function Dashboard() {
  const experiments = useAppStore((s) => s.experiments)
  const selectedExperimentId = useAppStore((s) => s.selectedExperimentId)
  const selectExperiment = useAppStore((s) => s.selectExperiment)
  const getCaliberChangedMetrics = useAppStore((s) => s.getCaliberChangedMetrics)

  const selectedExperiment = experiments.find((e) => e.id === selectedExperimentId)

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-4">
        <FlaskConical className="h-5 w-5 text-amber-400" />
        <h1 className="text-lg font-semibold text-slate-100">实验看板</h1>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedExperimentId ?? ""}
          onChange={(e) => selectExperiment(e.target.value || null)}
          className={cn(
            "h-9 rounded border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200",
            "focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          )}
        >
          <option value="">选择实验...</option>
          {experiments.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.name}
            </option>
          ))}
        </select>

        {selectedExperiment && (
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium",
              selectedExperiment.status === "confirmed" && "bg-emerald-500/15 text-emerald-400",
              selectedExperiment.status === "pending" && "bg-red-500/15 text-red-400",
              selectedExperiment.status === "manual_modified" && "bg-slate-400/15 text-slate-400",
              selectedExperiment.status === "importing" && "bg-amber-500/15 text-amber-400"
            )}
          >
            {STATUS_LABELS[selectedExperiment.status]}
          </span>
        )}
      </div>

      <FilterBar />

      {getCaliberChangedMetrics().length > 0 && <CaliberChangeBanner />}

      <PipelineView />

      <MetricComparison />

      <AutoJudgment />
    </div>
  )
}
