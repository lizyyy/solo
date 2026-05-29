import { useScreeningStore } from '@/store/screeningStore'
import { RoomConfig } from '@/types'
import { calculateWallArea, calculateCeilingArea, calculateTotalArea, calculateBudgetPerSqm } from '@/utils/budget'

const FIELDS: { key: keyof RoomConfig; label: string; suffix: string }[] = [
  { key: 'length', label: '长度', suffix: 'm' },
  { key: 'width', label: '宽度', suffix: 'm' },
  { key: 'height', label: '高度', suffix: 'm' },
  { key: 'budget', label: '预算', suffix: '¥' },
]

export default function RoomConfigPanel() {
  const { roomConfig, setRoomConfig } = useScreeningStore()
  const wallArea = calculateWallArea(roomConfig)
  const ceilingArea = calculateCeilingArea(roomConfig)
  const totalArea = calculateTotalArea(roomConfig)
  const budgetPerSqm = calculateBudgetPerSqm(roomConfig)
  const isLowBudget = budgetPerSqm < 80

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#1a2f2a' }}>
      <h3 className="text-amber-400 text-sm font-semibold mb-3">房间配置</h3>
      <div className="flex gap-2 mb-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">{f.label}({f.suffix})</label>
            <input
              type="number"
              min={0}
              step={f.key === 'budget' ? 1000 : 0.1}
              value={roomConfig[f.key]}
              onChange={(e) => setRoomConfig({ [f.key]: parseFloat(e.target.value) || 0 })}
              className="w-full rounded bg-gray-800 border border-gray-600 text-white text-sm px-2 py-1.5 focus:border-amber-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-gray-400">墙面面积</div>
          <div className="text-white font-medium">{wallArea.toFixed(1)} m²</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-gray-400">顶面面积</div>
          <div className="text-white font-medium">{ceilingArea.toFixed(1)} m²</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-gray-400">总面积</div>
          <div className="text-white font-medium">{totalArea.toFixed(1)} m²</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-gray-400">预算/m²</div>
          <div className={`font-medium ${isLowBudget ? 'text-red-400' : 'text-green-400'}`}>
            ¥{budgetPerSqm === Infinity ? '—' : budgetPerSqm.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}
