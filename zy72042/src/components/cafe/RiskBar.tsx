interface RiskBarProps {
  risk: number
  riskLimit: number
}

export default function RiskBar({ risk, riskLimit }: RiskBarProps) {
  const riskPercent = Math.min(Math.max(risk, 0), 1)
  const limitPercent = Math.min(Math.max(riskLimit, 0), 1)
  const overLimit = risk > riskLimit

  let riskColor = '#388E3C'
  if (risk > 0.6) riskColor = '#D32F2F'
  else if (risk > 0.3) riskColor = '#FBC02D'

  return (
    <div className={`card-cafe w-full ${overLimit ? 'animate-pulse-soft' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-cafe-brown">当前风险</span>
        <span className="text-sm font-bold" style={{ color: riskColor }}>
          {(risk * 100).toFixed(1)}%
        </span>
      </div>

      <div className="relative h-6">
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div className="h-full bg-safe-green/30" style={{ width: '30%' }} />
            <div className="h-full bg-risk-yellow/30" style={{ width: '30%' }} />
            <div className="h-full bg-risk-red/30" style={{ width: '40%' }} />
          </div>
        </div>

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out"
          style={{ left: `${riskPercent * 100}%` }}
        >
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: `8px solid ${riskColor}`,
            }}
          />
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-risk-red"
          style={{ left: `${limitPercent * 100}%` }}
        >
          <div
            className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-risk-red"
          />
          <div
            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-risk-red"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-safe-green">低风险</span>
        <span className="text-xs text-risk-red font-medium">
          风险红线: {(riskLimit * 100).toFixed(0)}%
        </span>
        <span className="text-xs text-risk-red">高风险</span>
      </div>
    </div>
  )
}
