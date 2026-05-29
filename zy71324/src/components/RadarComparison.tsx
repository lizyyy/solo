import { Material, FREQUENCY_BANDS, MATERIAL_TYPE_COLORS } from '@/types'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, ResponsiveContainer } from 'recharts'

interface RadarComparisonProps {
  materials: Material[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

export default function RadarComparison({ materials, selectedIds, onSelectionChange }: RadarComparisonProps) {
  const selected = materials.filter((m) => selectedIds.includes(m.id))

  const data = FREQUENCY_BANDS.map((freq) => {
    const entry: Record<string, string | number> = { frequency: freq }
    selected.forEach((m) => {
      entry[m.name] = m.coefficients[freq] ?? 0
    })
    return entry
  })

  const toggleId = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 2) {
        onSelectionChange(selectedIds.filter((i) => i !== id))
      }
    } else if (selectedIds.length < 5) {
      onSelectionChange([...selectedIds, id])
    }
  }

  return (
    <div className="flex gap-4">
      <div className="w-48 shrink-0 space-y-1">
        {materials.map((m) => (
          <label
            key={m.id}
            className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(m.id)}
              onChange={() => toggleId(m.id)}
              className="accent-amber-500"
            />
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: MATERIAL_TYPE_COLORS[m.type] }}
            />
            <span className="truncate">{m.name}</span>
          </label>
        ))}
      </div>

      <div className="flex-1 bg-[#0f1f1a] rounded-lg p-4">
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#2d4a3f" />
            <PolarAngleAxis dataKey="frequency" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a2f2a', border: '1px solid #2d4a3f', borderRadius: 6 }}
              labelStyle={{ color: '#e8a838' }}
              itemStyle={{ color: '#d1d5db' }}
            />
            {selected.map((m) => (
              <Radar
                key={m.id}
                name={m.name}
                dataKey={m.name}
                stroke={MATERIAL_TYPE_COLORS[m.type]}
                fill={MATERIAL_TYPE_COLORS[m.type]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
