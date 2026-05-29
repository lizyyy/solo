import { useExperimentStore } from "@/store/useExperimentStore"
import { validateParams } from "@/utils/validation"
import type { ParamState } from "@/types"
import { AlertTriangle, Ruler, Weight, Gauge, Route, Waves } from "lucide-react"

const PARAM_CONFIG: {
  key: keyof ParamState
  label: string
  unit: string
  min: number
  max: number
  step: number
  icon: React.ReactNode
}[] = [
  { key: "magnetSpacing", label: "磁铁间距", unit: "mm", min: -5, max: 100, step: 0.5, icon: <Ruler size={14} /> },
  { key: "vehicleMass", label: "车体质量", unit: "g", min: 1, max: 500, step: 1, icon: <Weight size={14} /> },
  { key: "trackLength", label: "轨道长度", unit: "mm", min: 100, max: 2000, step: 10, icon: <Route size={14} /> },
  { key: "current", label: "电流", unit: "A", min: 0, max: 60, step: 0.1, icon: <Gauge size={14} /> },
  { key: "disturbance", label: "扰动幅度", unit: "mm", min: 0, max: 20, step: 0.5, icon: <Waves size={14} /> },
]

export default function ParamPanel() {
  const params = useExperimentStore((s) => s.params)
  const setParam = useExperimentStore((s) => s.setParam)
  const validation = validateParams(params)

  const errorFields = new Set(validation.errors.map((e) => e.field))

  return (
    <div className="bg-[#0D1F3C] rounded-xl p-4 border border-[#1A3A5C] space-y-4">
      <h3 className="text-[#00E5CC] font-semibold text-sm tracking-wider uppercase flex items-center gap-2">
        <Gauge size={16} />
        参数调节
      </h3>

      {PARAM_CONFIG.map(({ key, label, unit, min, max, step, icon }) => {
        const hasError = errorFields.has(key)
        const errMsg = validation.errors.find((e) => e.field === key)?.message

        return (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#8899AA] flex items-center gap-1.5">
                {icon}
                {label}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={params[key]}
                  onChange={(e) => setParam(key, parseFloat(e.target.value) || 0)}
                  step={step}
                  className={`w-20 bg-[#0A1628] border rounded px-2 py-1 text-xs text-white text-right font-mono
                    ${hasError ? "border-red-500 animate-shake" : "border-[#1A3A5C] focus:border-[#00E5CC]"}
                    outline-none transition-colors`}
                />
                <span className="text-xs text-[#556677] w-6">{unit}</span>
              </div>
            </div>

            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={params[key]}
              onChange={(e) => setParam(key, parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer
                ${hasError ? "accent-red-500" : "accent-[#00E5CC]"}
                bg-[#1A3A5C]`}
            />

            {hasError && errMsg && (
              <div className="flex items-center gap-1 text-red-400 text-xs animate-fade-in">
                <AlertTriangle size={12} />
                {errMsg}
              </div>
            )}
          </div>
        )
      })}

      <div className="pt-2 border-t border-[#1A3A5C]">
        <div className="text-xs text-[#556677]">
          有效范围：间距 &gt; 0mm · 电流 0.1~50A · 质量 &gt; 0g
        </div>
      </div>
    </div>
  )
}
