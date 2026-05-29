import type { NoiseAdjacencyResult } from '../../shared/types'

interface Props {
  risk: NoiseAdjacencyResult
  onResolve: () => void
}

function riskBadge(risk: 'high' | 'medium' | 'low') {
  const map = {
    high: { label: '高风险', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    medium: { label: '中风险', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    low: { label: '低风险', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  }
  const s = map[risk]
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
}

function noiseColor(level: number) {
  return level <= 2 ? 'text-green-400' : level <= 3 ? 'text-yellow-400' : 'text-red-400'
}

export default function NoiseRiskCard({ risk, onResolve }: Props) {
  const isResolved = risk.status === 'resolved'

  return (
    <div className="bg-brand-800 border border-orange-500/20 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-sm font-medium text-orange-400">邻接风险</span>
            {riskBadge(risk.combinedRisk)}
            {isResolved && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">已处理</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-brand-100">
            <span className={noiseColor(risk.noiseA)}>{risk.roomA}</span>
            <span className="text-brand-400">↔</span>
            <span className={noiseColor(risk.noiseB)}>{risk.roomB}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-brand-300">
            <span>噪音: <span className={noiseColor(risk.noiseA)}>{risk.noiseA}</span> + <span className={noiseColor(risk.noiseB)}>{risk.noiseB}</span></span>
            <span>日期: <span className="mono text-brand-100">{risk.date}</span></span>
            <span>时段: <span className="mono text-brand-100">{risk.timeSlot}</span></span>
          </div>
          <p className="text-xs text-brand-400 mt-2">{risk.suggestion}</p>
        </div>
        {!isResolved && (
          <button
            onClick={onResolve}
            className="shrink-0 ml-3 text-xs px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded border border-green-500/30 transition-colors"
          >
            标记已处理
          </button>
        )}
      </div>
    </div>
  )
}
