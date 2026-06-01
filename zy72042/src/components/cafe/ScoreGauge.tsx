interface ScoreGaugeProps {
  score: number
  targetScore: number
}

export default function ScoreGauge({ score, targetScore }: ScoreGaugeProps) {
  const progress = Math.min(score / 100, 1)
  const radius = 60
  const stroke = 8
  const normalizedRadius = radius - stroke / 2
  const circumference = 2 * Math.PI * normalizedRadius
  const strokeDashoffset = circumference * (1 - progress)

  let color = '#D32F2F'
  if (score >= targetScore) {
    color = '#388E3C'
  } else if (score >= targetScore - 5) {
    color = '#FBC02D'
  }

  let rating = '待提升'
  if (score >= 90) rating = '优秀'
  else if (score >= 75) rating = '良好'
  else if (score >= 60) rating = '及格'

  return (
    <div className="card-cafe flex items-center justify-center aspect-square max-w-48">
      <div className="relative flex flex-col items-center">
        <svg width={radius * 2} height={radius * 2} className="-rotate-90">
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="none"
            stroke="#D7CCC8"
            strokeWidth={stroke}
            opacity={0.3}
          />
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-cafe-brown">{score.toFixed(0)}</span>
          <span className="text-xs text-cafe-brown/50">分</span>
        </div>

        <span
          className="mt-2 text-sm font-bold"
          style={{ color }}
        >
          {rating}
        </span>

        <span className="mt-1 text-xs text-cafe-brown/50">
          目标: {targetScore}
        </span>
      </div>
    </div>
  )
}
