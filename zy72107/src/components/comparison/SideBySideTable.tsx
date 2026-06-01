import type { ComputationTrace } from "@/types"
import { cn } from "@/lib/utils"
import { GitCompare } from "lucide-react"

interface SideBySideTableProps {
  traceA: ComputationTrace | null
  traceB: ComputationTrace | null
}

interface ComparisonRow {
  label: string
  valueA: string | number | boolean
  valueB: string | number | boolean
  isThresholdDiff?: boolean
}

function buildRows(a: ComputationTrace, b: ComputationTrace): ComparisonRow[] {
  return [
    {
      label: "参数版本",
      valueA: a.parameterVersion,
      valueB: b.parameterVersion,
    },
    {
      label: "阈值版本",
      valueA: a.thresholdVersion,
      valueB: b.thresholdVersion,
      isThresholdDiff: true,
    },
    {
      label: "中心终温 (°C)",
      valueA: a.result.finalCenterTemp,
      valueB: b.result.finalCenterTemp,
    },
    {
      label: "表面终温 (°C)",
      valueA: a.result.finalSurfaceTemp,
      valueB: b.result.finalSurfaceTemp,
    },
    {
      label: "温度梯度 (°C)",
      valueA: a.result.gradient,
      valueB: b.result.gradient,
    },
    {
      label: "是否超阈值",
      valueA: a.result.isExceedingThreshold ? "是" : "否",
      valueB: b.result.isExceedingThreshold ? "是" : "否",
    },
  ]
}

export default function SideBySideTable({ traceA, traceB }: SideBySideTableProps) {
  if (!traceA && !traceB) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-stone-400">
        <GitCompare className="h-10 w-10 mb-2" />
        <span>请先计算</span>
      </div>
    )
  }

  if (!traceA || !traceB) {
    const existing = traceA ?? traceB!
    const rows = buildRows(
      traceA ?? emptyTrace(existing),
      traceB ?? emptyTrace(existing),
    )
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-2 px-3 text-stone-500 font-medium w-36">指标</th>
              <th className="text-center py-2 px-3 font-medium text-stone-700">
                {traceA ? traceA.computedAt : "请先计算"}
              </th>
              <th className="text-center py-2 px-3 font-medium text-stone-700">
                {traceB ? traceB.computedAt : "请先计算"}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <RowRenderer
                key={row.label}
                row={row}
                hasA={!!traceA}
                hasB={!!traceB}
              />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const rows = buildRows(traceA, traceB)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-stone-200">
            <th className="text-left py-2 px-3 text-stone-500 font-medium w-36">指标</th>
            <th className="text-center py-2 px-3 font-medium text-stone-700">
              {traceA.computedAt}
            </th>
            <th className="text-center py-2 px-3 font-medium text-stone-700">
              {traceB.computedAt}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RowRenderer key={row.label} row={row} hasA hasB />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowRenderer({
  row,
  hasA,
  hasB,
}: {
  row: ComparisonRow
  hasA: boolean
  hasB: boolean
}) {
  const isDiff = String(row.valueA) !== String(row.valueB)
  const cellClass = cn(
    "py-2 px-3 text-center",
    isDiff && row.isThresholdDiff && "bg-red-50 text-red-700",
    isDiff && !row.isThresholdDiff && "bg-amber-50 text-amber-800",
  )

  return (
    <tr className="border-b border-stone-100">
      <td className="py-2 px-3 text-stone-600">{row.label}</td>
      <td className={cellClass}>{hasA ? String(row.valueA) : "—"}</td>
      <td className={cellClass}>{hasB ? String(row.valueB) : "—"}</td>
    </tr>
  )
}

function emptyTrace(reference: ComputationTrace): ComputationTrace {
  return {
    id: "",
    recordId: reference.recordId,
    batchId: reference.batchId,
    parameterVersion: 0,
    thresholdVersion: 0,
    steps: [],
    result: {
      finalCenterTemp: 0,
      finalSurfaceTemp: 0,
      gradient: 0,
      isExceedingThreshold: false,
      thresholdVersionUsed: 0,
      thresholdValueUsed: 0,
      radialProfile: [],
    },
    computedAt: "",
  }
}
