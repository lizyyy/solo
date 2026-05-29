import { ScoreBreakdown, WeightConfig, LOW_FREQ_BANDS, MID_FREQ_BANDS, HIGH_FREQ_BANDS } from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface BarComparisonProps {
  scores: ScoreBreakdown[]
  weightConfig: WeightConfig
  onBarClick: (materialId: string, band: string) => void
}

const BAND_COLORS: Record<string, string> = {
  low: '#e8a838',
  mid: '#2dd4bf',
  high: '#3b82f6',
}

export default function BarComparison({ scores, weightConfig: _wc, onBarClick }: BarComparisonProps) {
  const data = scores.map((s) => {
    const lowVals = LOW_FREQ_BANDS.map((f) => s.weightedValues[f] ?? 0)
    const midVals = MID_FREQ_BANDS.map((f) => s.weightedValues[f] ?? 0)
    const highVals = HIGH_FREQ_BANDS.map((f) => s.weightedValues[f] ?? 0)
    return {
      name: s.materialName,
      materialId: s.materialId,
      low: lowVals.reduce((a, b) => a + b, 0) / lowVals.length,
      mid: midVals.reduce((a, b) => a + b, 0) / midVals.length,
      high: highVals.reduce((a, b) => a + b, 0) / highVals.length,
    }
  })

  const handleClick = (materialId: string, band: string) => {
    onBarClick(materialId, band)
  }

  return (
    <div className="bg-[#0f1f1a] rounded-lg p-4">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barCategoryGap="20%">
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a2f2a', border: '1px solid #2d4a3f', borderRadius: 6 }}
            labelStyle={{ color: '#e8a838' }}
            itemStyle={{ color: '#d1d5db' }}
          />
          <Legend
            wrapperStyle={{ color: '#9ca3af' }}
            formatter={(value: string) => (
              <span style={{ color: '#9ca3af' }}>
                {value === 'low' ? '低频' : value === 'mid' ? '中频' : '高频'}
              </span>
            )}
          />
          <Bar
            dataKey="low"
            name="low"
            onClick={(payload) => handleClick(payload.materialId, 'low')}
            cursor="pointer"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={BAND_COLORS.low} />
            ))}
          </Bar>
          <Bar
            dataKey="mid"
            name="mid"
            onClick={(payload) => handleClick(payload.materialId, 'mid')}
            cursor="pointer"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={BAND_COLORS.mid} />
            ))}
          </Bar>
          <Bar
            dataKey="high"
            name="high"
            onClick={(payload) => handleClick(payload.materialId, 'high')}
            cursor="pointer"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={BAND_COLORS.high} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
