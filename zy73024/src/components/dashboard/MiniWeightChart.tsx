import { weightRecords } from '../../data/mockWeightRecords'

interface MiniWeightChartProps {
  petId: string
  width?: number
  height?: number
}

export default function MiniWeightChart({ petId, width = 180, height = 56 }: MiniWeightChartProps) {
  const records = weightRecords
    .filter((r) => r.petId === petId && r.isIncluded)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (records.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ width, height }}>
        <span className="text-xs text-clay-400">称重不足</span>
      </div>
    )
  }

  const weights = records.map((r) => r.weight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 0.1

  const padX = 8
  const padY = 6
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const points = records.map((r, i) => {
    const x = padX + (records.length === 1 ? innerW / 2 : (i / (records.length - 1)) * innerW)
    const y = padY + innerH - ((r.weight - minW) / range) * innerH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const lastIdx = points.length - 1
  const [lastX, lastY] = points[lastIdx].split(',').map(Number)

  return (
    <div className="flex items-center justify-center" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#8FA68C"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw"
        />
        <circle cx={lastX} cy={lastY} r={3.5} fill="#C87941" />
      </svg>
    </div>
  )
}
