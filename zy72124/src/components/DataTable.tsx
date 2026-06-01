import type { MooringRecord } from "@/types"
import { formatForce, getUnitLabel } from "@/utils/unitConversion"

interface DataTableProps {
  record: MooringRecord
}

export function DataTable({ record }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="text-left py-2 px-3 text-slate-400 font-mono text-xs">采样点</th>
            <th className="text-right py-2 px-3 text-slate-400 font-mono text-xs">原始值</th>
            <th className="text-left py-2 px-3 text-slate-400 font-mono text-xs">单位</th>
            <th className="text-right py-2 px-3 text-slate-400 font-mono text-xs">换算值 (kN)</th>
            <th className="text-center py-2 px-3 text-slate-400 font-mono text-xs">状态</th>
          </tr>
        </thead>
        <tbody>
          {record.processedData.map((pt, i) => {
            const raw = record.rawData[i]
            return (
              <tr
                key={pt.sampleIndex}
                className={`border-b border-slate-800/50 ${
                  pt.wasInterpolated ? "bg-amber-500/5" : ""
                } ${raw.isGap && !pt.wasInterpolated ? "bg-red-500/5" : ""}`}
              >
                <td className="py-2 px-3 font-mono text-slate-300">#{pt.sampleIndex + 1}</td>
                <td className="py-2 px-3 font-mono text-right text-slate-200">
                  {raw.value !== null ? raw.value.toFixed(raw.unit === "N" ? 0 : 1) : "—"}
                </td>
                <td className="py-2 px-3 text-slate-400 text-xs">{getUnitLabel(pt.originalUnit)}</td>
                <td className="py-2 px-3 font-mono text-right text-slate-100">
                  {formatForce(pt.valueKilonewtons, 3)}
                </td>
                <td className="py-2 px-3 text-center">
                  {pt.wasInterpolated ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      插值
                    </span>
                  ) : raw.isGap ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      缺口
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">正常</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
