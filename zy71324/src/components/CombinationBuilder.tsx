import { useState } from 'react'
import { useMaterialStore } from '@/store/materialStore'
import { useScreeningStore } from '@/store/screeningStore'
import { calculateCombinationScore } from '@/utils/scoring'
import { calculateTotalArea, calculateMaterialCost, formatCurrency } from '@/utils/budget'
import { CombinationItem, MaterialCombination, FREQUENCY_BANDS } from '@/types'
import { Plus, X } from 'lucide-react'

export default function CombinationBuilder() {
  const { materials } = useMaterialStore()
  const { weightConfig, roomConfig, combinations, addCombination } = useScreeningStore()
  const [slots, setSlots] = useState<CombinationItem[]>([])
  const [name, setName] = useState('')

  const addSlot = (materialId: string) => {
    if (slots.some((s) => s.materialId === materialId)) return
    setSlots([...slots, { materialId, areaRatio: 50 }])
  }

  const removeSlot = (materialId: string) => {
    setSlots(slots.filter((s) => s.materialId !== materialId))
  }

  const updateRatio = (materialId: string, ratio: number) => {
    setSlots(slots.map((s) => (s.materialId === materialId ? { ...s, areaRatio: ratio } : s)))
  }

  const score = calculateCombinationScore(materials, slots, weightConfig)
  const totalArea = calculateTotalArea(roomConfig)
  const totalCost = slots.reduce((sum, s) => {
    const mat = materials.find((m) => m.id === s.materialId)
    return sum + (mat ? calculateMaterialCost(mat.unitPrice, totalArea * s.areaRatio / 100) : 0)
  }, 0)

  const saveCombination = () => {
    if (slots.length === 0) return
    const combo: MaterialCombination = {
      id: `combo-${Date.now()}`,
      name: name || `组合 ${combinations.length + 1}`,
      items: slots,
      totalCost,
      combinedCoefficients: score.combinedCoefficients,
      weightedScore: score.weightedScore,
    }
    addCombination(combo)
    setSlots([])
    setName('')
  }

  const available = materials.filter((m) => !slots.some((s) => s.materialId === m.id))

  return (
    <div className="rounded-xl p-4 h-full flex flex-col" style={{ backgroundColor: '#1a2f2a' }}>
      <h3 className="text-amber-400 text-sm font-semibold mb-3">组合构建器</h3>
      <div className="flex gap-3 flex-1 min-h-0">
        <div className="w-1/2 overflow-y-auto space-y-1 pr-1">
          <div className="text-xs text-gray-400 mb-1">可选材料</div>
          {available.map((m) => (
            <button
              key={m.id}
              onClick={() => addSlot(m.id)}
              className="w-full text-left px-2 py-1.5 rounded text-xs bg-gray-800/60 hover:bg-amber-900/40 text-gray-300 hover:text-amber-300 flex items-center justify-between"
            >
              <span className="truncate">{m.name}</span>
              <Plus size={12} className="text-amber-500 shrink-0" />
            </button>
          ))}
        </div>
        <div className="w-1/2 flex flex-col">
          <div className="text-xs text-gray-400 mb-1">组合槽位</div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {slots.map((s) => {
              const mat = materials.find((m) => m.id === s.materialId)
              if (!mat) return null
              return (
                <div key={s.materialId} className="bg-gray-800/50 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white truncate">{mat.name}</span>
                    <button onClick={() => removeSlot(s.materialId)} className="text-red-400 hover:text-red-300">
                      <X size={12} />
                    </button>
                  </div>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={s.areaRatio}
                    onChange={(e) => updateRatio(s.materialId, parseInt(e.target.value))}
                    className="w-full h-1 appearance-none rounded bg-amber-900/50 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400"
                  />
                  <div className="text-xs text-amber-300 text-right">{s.areaRatio}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {slots.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <div className="grid grid-cols-3 gap-2 text-xs text-center mb-2">
            {FREQUENCY_BANDS.map((f) => (
              <div key={f} className="text-gray-400">
                {f}: <span className="text-white">{score.combinedCoefficients[f]}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-400">总费用: <span className="text-amber-300">{formatCurrency(Math.round(totalCost))}</span></span>
            <span className="text-gray-400">加权评分: <span className="text-amber-300">{score.weightedScore}</span></span>
          </div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="组合名称"
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={saveCombination}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-black text-xs font-semibold rounded"
            >
              保存组合
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
