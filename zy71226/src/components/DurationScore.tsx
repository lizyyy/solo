import { useStore } from '@/store/useStore'

export default function DurationScore() {
  const target = useStore(s => s.targetDuration)
  const setTarget = useStore(s => s.setTargetDuration)
  const actual = useStore(s => s.getPortfolioDuration())
  const score = useStore(s => s.getDurationScore())

  const radius = 55
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score)) / 100
  const offset = circumference * (1 - progress)
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#d4a843' : '#ef4444'
  const diff = actual - target

  return (
    <div className="glass-panel rounded-xl p-5 flex flex-col items-center">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">久期评分</h3>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#1e3a5f" strokeWidth="8" />
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
        />
        <text x="70" y="68" textAnchor="middle" fill="#e2e8f0" fontSize="32" fontWeight="700" className="font-mono">
          {score}
        </text>
        <text x="70" y="88" textAnchor="middle" fill="#64748b" fontSize="11">分</text>
      </svg>
      <div className="mt-3 w-full space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">目标久期</span>
          <input
            type="number"
            value={target}
            onChange={e => setTarget(parseFloat(e.target.value) || 0)}
            step="0.5"
            min="1"
            max="15"
            className="w-20 bg-navy-700 border border-navy-600 rounded px-2 py-1 text-right font-mono text-sm text-gold-400 focus:outline-none focus:border-gold-500"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">实际久期</span>
          <span className="font-mono text-sm font-medium" style={{ color }}>
            {actual.toFixed(2)}年
          </span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-navy-600">
          <span className="text-xs text-slate-500">偏差</span>
          <span className={`font-mono text-sm font-semibold ${Math.abs(diff) > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(2)}年
          </span>
        </div>
      </div>
    </div>
  )
}
