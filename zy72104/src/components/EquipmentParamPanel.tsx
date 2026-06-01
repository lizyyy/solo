import { useState } from 'react'
import { useStore } from '@/store'
import type { EquipmentParams } from '@/types'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'

const PARAM_GROUPS: { label: string; keys: (keyof EquipmentParams)[] }[] = [
  {
    label: '泵参数',
    keys: ['pumpModel', 'ratedHead', 'ratedHeadUnit', 'ratedFlow', 'ratedFlowUnit', 'efficiency'],
  },
  {
    label: '管路参数',
    keys: ['pipeDiameter', 'pipeDiameterUnit', 'pipeLength', 'pipeLengthUnit', 'roughness', 'localLossCoeff'],
  },
  {
    label: '运行参数',
    keys: ['suctionPressure', 'suctionPressureUnit', 'dischargePressure', 'dischargePressureUnit', 'elevationDiff', 'elevationDiffUnit'],
  },
  {
    label: '流体参数',
    keys: ['fluidDensity', 'fluidDensityUnit'],
  },
]

const UNIT_OPTIONS: Record<string, string[]> = {
  ratedHeadUnit: ['m', 'ft', 'kPa', 'mH2O'],
  ratedFlowUnit: ['m³/h', 'L/s', 'L/min', 'm³/s', 'gpm'],
  pipeDiameterUnit: ['mm', 'cm', 'm', 'in'],
  pipeLengthUnit: ['m', 'km', 'ft'],
  suctionPressureUnit: ['kgf/cm²', 'MPa', 'kPa', 'bar', 'psi', 'mH2O'],
  dischargePressureUnit: ['kgf/cm²', 'MPa', 'kPa', 'bar', 'psi', 'mH2O'],
  elevationDiffUnit: ['m', 'cm', 'ft'],
  fluidDensityUnit: ['kg/m³', 'g/cm³'],
}

const PARAM_LABELS: Record<string, string> = {
  pumpModel: '泵型号',
  ratedHead: '额定扬程',
  ratedHeadUnit: '单位',
  ratedFlow: '额定流量',
  ratedFlowUnit: '单位',
  efficiency: '泵效率(%)',
  pipeDiameter: '管径',
  pipeDiameterUnit: '单位',
  pipeLength: '管长',
  pipeLengthUnit: '单位',
  roughness: '粗糙度(mm)',
  localLossCoeff: '局部损失系数ΣK',
  suctionPressure: '吸入压力',
  suctionPressureUnit: '单位',
  dischargePressure: '排出压力',
  dischargePressureUnit: '单位',
  elevationDiff: '高程差',
  elevationDiffUnit: '单位',
  fluidDensity: '流体密度',
  fluidDensityUnit: '单位',
}

const NUMBER_KEYS = new Set<string>([
  'ratedHead', 'ratedFlow', 'efficiency', 'pipeDiameter', 'pipeLength',
  'roughness', 'localLossCoeff', 'suctionPressure', 'dischargePressure',
  'elevationDiff', 'fluidDensity',
])

export default function EquipmentParamPanel() {
  const batchId = useStore((s) => s.currentBatchId)
  const batch = useStore((s) => s.batches.find((b) => b.id === s.currentBatchId))
  const updateParams = useStore((s) => s.updateEquipmentParams)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '泵参数': true,
    '管路参数': true,
    '运行参数': true,
    '流体参数': true,
  })

  if (!batchId || !batch) return null

  const params = batch.equipmentParams

  const handleChange = (key: keyof EquipmentParams, value: string | number) => {
    updateParams(batchId, { [key]: value })
  }

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60">
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm text-[#a8d8ea] tracking-wide">⚙️ 设备参数</span>
        <Save size={14} className="text-[#16c79a]" />
      </div>
      <div className="px-4 pb-4 space-y-3">
        {PARAM_GROUPS.map((group) => (
          <div key={group.label} className="border border-[#0f3460]/30 rounded">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#a8d8ea]/80 hover:bg-[#0f3460]/20 transition-colors"
              onClick={() => toggleGroup(group.label)}
            >
              <span>{group.label}</span>
              {expandedGroups[group.label] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expandedGroups[group.label] && (
              <div className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {group.keys.map((key) => {
                  const label = PARAM_LABELS[key] || key
                  const isUnit = key.endsWith('Unit')
                  const isNumber = NUMBER_KEYS.has(key)
                  const value = params[key]

                  if (isUnit) {
                    const options = UNIT_OPTIONS[key] || []
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <label className="text-[11px] text-[#a8d8ea]/60 w-24 text-right shrink-0">{label}</label>
                        <select
                          className="bg-[#1a1a2e] border border-[#0f3460]/50 rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#a8d8ea]/50 flex-1"
                          value={String(value)}
                          onChange={(e) => handleChange(key, e.target.value)}
                        >
                          {options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )
                  }

                  return (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-[11px] text-[#a8d8ea]/60 w-24 text-right shrink-0">{label}</label>
                      <input
                        className="bg-[#1a1a2e] border border-[#0f3460]/50 rounded px-2 py-1 text-xs text-[#e2e8f0] font-mono focus:outline-none focus:border-[#a8d8ea]/50 flex-1"
                        type={isNumber ? 'number' : 'text'}
                        step={isNumber ? 'any' : undefined}
                        value={String(value)}
                        onChange={(e) => handleChange(key, isNumber ? Number(e.target.value) : e.target.value)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
