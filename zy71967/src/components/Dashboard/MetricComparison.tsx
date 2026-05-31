import { useMemo } from "react"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"
import { SOURCE_LABELS } from "@/types"
import type { DataSourceType, Metric } from "@/types"

const sourceOrder: DataSourceType[] = ["evaluation", "online_feedback", "config"]

interface RowData {
  name: string
  values: Record<DataSourceType, string | null>
  mismatched: boolean
  caliberChanged: boolean
}

function buildRows(metrics: Metric[]): RowData[] {
  const grouped = new Map<string, Map<DataSourceType, Metric>>()
  for (const m of metrics) {
    if (!grouped.has(m.name)) grouped.set(m.name, new Map())
    grouped.get(m.name)!.set(m.source, m)
  }

  const rows: RowData[] = []
  for (const [name, bySource] of grouped) {
    const values: Record<DataSourceType, string | null> = {
      evaluation: null,
      online_feedback: null,
      config: null,
    }
    let caliberChanged = false
    for (const [src, m] of bySource) {
      values[src] = m.value
      if (m.caliberChanged) caliberChanged = true
    }

    const presentValues: string[] = []
    for (const src of sourceOrder) {
      if (values[src] !== null) presentValues.push(values[src]!)
    }
    const mismatched = presentValues.length > 1 && new Set(presentValues).size > 1

    rows.push({ name, values, mismatched, caliberChanged })
  }

  return rows
}

export default function MetricComparison() {
  const selectedExperimentId = useAppStore((s) => s.selectedExperimentId)
  const getExperimentMetrics = useAppStore((s) => s.getExperimentMetrics)

  const metrics = selectedExperimentId ? getExperimentMetrics(selectedExperimentId) : []
  const rows = useMemo(() => buildRows(metrics), [metrics])

  return (
    <div className="rounded-md bg-slate-800/60 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">指标比对</h3>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {selectedExperimentId ? "暂无指标数据" : "请先选择实验"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-3 py-2 text-left font-medium text-slate-400">指标名</th>
                {sourceOrder.map((src) => (
                  <th key={src} className="px-3 py-2 text-left font-medium text-slate-400">
                    {SOURCE_LABELS[src]}
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-medium text-slate-400">比对结果</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b border-slate-800">
                  <td className="px-3 py-2 font-medium text-slate-200">{row.name}</td>
                  {sourceOrder.map((src) => (
                    <td key={src} className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-block rounded px-2 py-0.5 font-mono text-xs",
                          row.values[src] !== null
                            ? row.mismatched
                              ? "border border-amber-500/60 bg-amber-500/10 text-amber-300"
                              : "bg-slate-700/50 text-slate-300"
                            : "text-slate-600"
                        )}
                      >
                        {row.values[src] ?? "-"}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {row.mismatched ? (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                        值不一致
                      </span>
                    ) : row.caliberChanged ? (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                        口径变更
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                        一致
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
