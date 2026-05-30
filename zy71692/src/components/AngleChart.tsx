import type { AngleResult } from '@/types'

interface AngleChartProps {
  angleResults: AngleResult[]
  selectedJoints: string[]
  currentFrame: number
  jumpThreshold: number
  onFrameClick: (frame: number) => void
}

const COLORS: Record<string, string> = {
  leftKnee: '#0D9488',
  rightKnee: '#14B8A6',
  leftHip: '#F97316',
  rightHip: '#FB923C',
  leftElbow: '#8B5CF6',
  rightElbow: '#A78BFA',
}

export default function AngleChart({
  angleResults,
  selectedJoints,
  currentFrame,
  jumpThreshold,
  onFrameClick,
}: AngleChartProps) {
  const filtered = angleResults.filter((a) => selectedJoints.includes(a.jointName))
  if (filtered.length === 0) return <div className="text-gray-500 text-sm p-4">未选择关节</div>

  const frames = [...new Set(filtered.map((a) => a.frameIndex))].sort((a, b) => a - b)
  const maxFrame = frames[frames.length - 1] ?? 1
  const minFrame = frames[0] ?? 0
  const frameRange = maxFrame - minFrame || 1

  const allAngles = filtered.map((a) => a.angle)
  const minAngle = Math.floor(Math.min(...allAngles) / 10) * 10
  const maxAngle = Math.ceil(Math.max(...allAngles) / 10) * 10
  const angleRange = maxAngle - minAngle || 1

  const W = 600
  const H = 200
  const PX = 40
  const PY = 20
  const plotW = W - PX - 10
  const plotH = H - PY * 2

  const toX = (fi: number) => PX + ((fi - minFrame) / frameRange) * plotW
  const toY = (angle: number) => PY + plotH - ((angle - minAngle) / angleRange) * plotH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      {Array.from({ length: 5 }, (_, i) => {
        const val = minAngle + (angleRange * i) / 4
        const y = toY(val)
        return (
          <g key={i}>
            <line x1={PX} y1={y} x2={W - 10} y2={y} stroke="#374151" strokeWidth={0.5} />
            <text x={PX - 4} y={y + 4} textAnchor="end" fill="#9CA3AF" fontSize={9}>
              {val.toFixed(0)}°
            </text>
          </g>
        )
      })}
      {selectedJoints.map((jointName) => {
        const data = filtered.filter((a) => a.jointName === jointName).sort((a, b) => a.frameIndex - b.frameIndex)
        const color = COLORS[jointName] ?? '#6B7280'
        const points = data.map((d) => `${toX(d.frameIndex)},${toY(d.angle)}`).join(' ')
        const anomalies = data.filter((d) => d.isAnomaly)
        return (
          <g key={jointName}>
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} opacity={0.8} />
            {anomalies.map((d) => (
              <line
                key={`${d.frameIndex}-${d.jointName}`}
                x1={toX(d.frameIndex)}
                y1={PY}
                x2={toX(d.frameIndex)}
                y2={PY + plotH}
                stroke="#EF4444"
                strokeWidth={0.5}
                opacity={0.6}
              />
            ))}
          </g>
        )
      })}
      <line
        x1={toX(currentFrame)}
        y1={PY}
        x2={toX(currentFrame)}
        y2={PY + plotH}
        stroke="#F97316"
        strokeWidth={1.5}
      />
      <rect x={PX} y={PY} width={plotW} height={plotH} fill="transparent" onClick={(e) => {
        const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect()
        if (!rect) return
        const x = e.clientX - rect.left
        const fraction = (x - PX) / plotW
        const frame = Math.round(minFrame + fraction * frameRange)
        onFrameClick(frame)
      }} style={{ cursor: 'pointer' }} />
      {selectedJoints.map((jn, i) => (
        <circle key={`legend-${jn}`} cx={PX + i * 70} cy={H - 5} r={4} fill={COLORS[jn] ?? '#6B7280'} />
      ))}
      {selectedJoints.map((jn, i) => (
        <text key={`label-${jn}`} x={PX + i * 70 + 8} y={H - 1} fill="#9CA3AF" fontSize={8}>{jn}</text>
      ))}
    </svg>
  )
}
