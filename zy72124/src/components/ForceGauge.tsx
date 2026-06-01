import type { ForceResult } from "@/types"
import { formatForce } from "@/utils/unitConversion"
import { getFormulaBreakdown } from "@/utils/calculation"
import { Gauge, Wind, Waves, Droplets, Activity, GitCompare } from "lucide-react"

interface ForceGaugeProps {
  forceResult: ForceResult
}

export function ForceGauge({ forceResult }: ForceGaugeProps) {
  const maxForce = Math.max(forceResult.measuredPeakKN, forceResult.theoreticalTotalKN) * 1.3
  const formulas = getFormulaBreakdown(forceResult.paramsUsed)

  const theoreticalSegments = [
    { label: "水流力", value: forceResult.theoreticalCurrentKN, icon: Droplets, color: "#3B82F6" },
    { label: "波浪力", value: forceResult.theoreticalWaveKN, icon: Waves, color: "#06B6D4" },
    { label: "风力", value: forceResult.theoreticalWindKN, icon: Wind, color: "#8B5CF6" },
  ]

  const ratio = forceResult.measuredPeakKN / forceResult.theoreticalTotalKN
  let gaugeColor = "#2ECC71"
  if (ratio > 1.5) gaugeColor = "#E74C3C"
  else if (ratio > 1.2) gaugeColor = "#F39C12"

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-5 h-5 text-[#FF6B35]" />
        <h3 className="text-sm font-semibold text-slate-200">系泊力计算结果</h3>
      </div>

      <div className="flex items-center justify-center py-4">
        <div className="relative w-48 h-48">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#1E293B" strokeWidth="16" />
            {(() => {
              const circumference = 2 * Math.PI * 80
              const pct = Math.min(forceResult.measuredPeakKN / maxForce, 1)
              return (
                <circle
                  cx="100" cy="100" r="80"
                  fill="none" stroke={gaugeColor} strokeWidth="16"
                  strokeDasharray={`${circumference * pct} ${circumference * (1 - pct)}`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              )
            })()}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl font-bold text-slate-100">
              {forceResult.measuredPeakKN.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 mt-1">kN（实测峰值）</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">实测均值</div>
          <div className="font-mono text-sm text-slate-200">{forceResult.measuredAvgKN.toFixed(2)} kN</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">理论计算值</div>
          <div className="font-mono text-sm text-slate-200">{forceResult.theoreticalTotalKN.toFixed(2)} kN</div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/40 border border-slate-700/20">
        <GitCompare className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="text-xs text-slate-300">{forceResult.deviationNote}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Activity className="w-3 h-3" />
          理论分解（物理近似参考）
        </div>
        {theoreticalSegments.map((seg) => {
          const Icon = seg.icon
          const pct = maxForce > 0 ? (seg.value / maxForce) * 100 : 0
          return (
            <div key={seg.label} className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-400 w-12">{seg.label}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: seg.color }}
                />
              </div>
              <span className="text-xs font-mono text-slate-300 w-20 text-right">
                {formatForce(seg.value, 3)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/30">
        <div className="text-xs text-slate-400 mb-2">计算公式展开</div>
        <div className="space-y-1">
          {formulas.map((f, i) => (
            <div key={i} className="font-mono text-xs text-slate-300">{f}</div>
          ))}
          <div className="font-mono text-xs text-[#FF6B35] mt-1">
            F_theoretical = {formatForce(forceResult.theoreticalCurrentKN, 3)} + {formatForce(forceResult.theoreticalWaveKN, 3)} + {formatForce(forceResult.theoreticalWindKN, 3)} = {formatForce(forceResult.theoreticalTotalKN, 2)}
          </div>
        </div>
      </div>
    </div>
  )
}
