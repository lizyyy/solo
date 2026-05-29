import { useExperimentStore } from "@/store/useExperimentStore"
import type { AnomalyFilterType, AnomalyType } from "@/types"
import { ANOMALY_LABELS } from "@/types"
import { Filter } from "lucide-react"

const FILTER_TABS: { key: AnomalyFilterType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "current_exceed", label: "电流越界" },
  { key: "negative_spacing", label: "间距为负" },
  { key: "oscillation_diverge", label: "振荡发散" },
]

export default function AnomalyFilter() {
  const anomalyFilter = useExperimentStore((s) => s.anomalyFilter)
  const setAnomalyFilter = useExperimentStore((s) => s.setAnomalyFilter)
  const records = useExperimentStore((s) => s.records)

  const counts: Record<AnomalyFilterType, number> = {
    all: records.length,
    current_exceed: records.filter((r) => r.result.anomalyType === "current_exceed").length,
    negative_spacing: records.filter((r) => r.result.anomalyType === "negative_spacing").length,
    oscillation_diverge: records.filter((r) => r.result.anomalyType === "oscillation_diverge").length,
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-[#00E5CC]" />
        <h3 className="text-[#00E5CC] font-semibold text-sm tracking-wider uppercase">异常筛选</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(({ key, label }) => {
          const active = anomalyFilter === key
          const count = counts[key]

          return (
            <button
              key={key}
              onClick={() => setAnomalyFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${active ? "bg-[#00E5CC]/20 text-[#00E5CC] border border-[#00E5CC]/40" : "bg-[#0A1628] text-[#8899AA] border border-[#1A3A5C] hover:border-[#00E5CC]/30"}`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                    ${active ? "bg-[#00E5CC]/30 text-[#00E5CC]" : "bg-[#1A3A5C] text-[#8899AA]"}`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
