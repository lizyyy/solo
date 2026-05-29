import { ScoreBreakdown, Material, ValidationIssue } from '@/types'

interface ScoreRankingProps {
  scores: ScoreBreakdown[]
  materials: Material[]
  issues: ValidationIssue[]
  onSelect: (breakdown: ScoreBreakdown) => void
}

export default function ScoreRanking({ scores, materials, issues, onSelect }: ScoreRankingProps) {
  const ranked = [...scores].sort((a, b) => b.totalScore - a.totalScore)

  const getTags = (breakdown: ScoreBreakdown) => {
    const matIssues = issues.filter((i) => i.materialId === breakdown.materialId)
    const tags: { label: string; color: string }[] = []
    if (matIssues.some((i) => i.type === 'budget_overrun')) tags.push({ label: '预算超限', color: 'bg-red-500/80 text-white' })
    if (matIssues.some((i) => i.type === 'frequency_missing')) tags.push({ label: '低频缺样', color: 'bg-yellow-500/80 text-black' })
    if (matIssues.some((i) => i.type === 'coefficient_out_of_range')) tags.push({ label: '系数越界', color: 'bg-red-600/80 text-white' })
    return tags
  }

  const getBarColor = (score: number) => {
    if (score >= 0.7) return 'from-green-500 to-amber-400'
    if (score >= 0.4) return 'from-amber-500 to-yellow-400'
    return 'from-red-500 to-amber-500'
  }

  return (
    <div className="rounded-xl p-4 h-full flex flex-col" style={{ backgroundColor: '#1a2f2a' }}>
      <h3 className="text-amber-400 text-sm font-semibold mb-3">评分排名</h3>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {ranked.map((b, idx) => {
          const tags = getTags(b)
          const pct = Math.max(0, Math.min(100, b.totalScore * 100))
          return (
            <button
              key={b.materialId}
              onClick={() => onSelect(b)}
              className="w-full text-left bg-gray-800/50 hover:bg-amber-900/30 rounded px-3 py-2 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-amber-400 w-5">{idx + 1}</span>
                <span className="text-sm text-white truncate flex-1">{b.materialName}</span>
                <span className="text-xs font-mono text-amber-300">{b.totalScore.toFixed(3)}</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden ml-7">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${getBarColor(b.totalScore)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {tags.length > 0 && (
                <div className="flex gap-1 ml-7 mt-1">
                  {tags.map((t, i) => (
                    <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${t.color}`}>{t.label}</span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
