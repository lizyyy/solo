import { useEffect } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Target, Scale } from 'lucide-react'
import { useStore } from '@/store/useStore'
import StepIndicator from '@/components/StepIndicator'

export default function DemoPage() {
  const { scoringData, currentStep, loading, fetchScoringResults, updateResults } = useStore()

  useEffect(() => {
    fetchScoringResults()
  }, [fetchScoringResults])

  const results = scoringData?.results || []
  const totalScore = scoringData?.totalScore || 0
  const totalWeight = scoringData?.totalWeight || 0
  const stepStatus = scoringData?.stepStatus || 'imported'

  const maxWeight = Math.max(...results.map((r) => r.weight), 1)
  const hasComparison = results.some((r) => r.previousScore !== undefined)
  const totalPreviousScore = results.reduce((sum, r) => sum + (r.previousWeightedScore ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-slate-100">课堂演示</h2>
        <StepIndicator currentStep={stepStatus} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Scale size={16} className="text-blue-400" />
            <span className="text-sm font-medium text-slate-300">总权重</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">{totalWeight.toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-amber-500" />
            <span className="text-sm font-medium text-slate-300">加权总分</span>
          </div>
          <div className="text-3xl font-bold text-amber-500">{totalScore.toFixed(2)}</div>
          {hasComparison && totalPreviousScore > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">更新前: {totalPreviousScore.toFixed(2)}</span>
              <span
                className={`text-xs font-medium inline-flex items-center gap-0.5 ${
                  totalScore > totalPreviousScore
                    ? 'text-emerald-400'
                    : totalScore < totalPreviousScore
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {totalScore > totalPreviousScore ? (
                  <TrendingUp size={12} />
                ) : totalScore < totalPreviousScore ? (
                  <TrendingDown size={12} />
                ) : null}
                {totalScore > totalPreviousScore ? '+' : ''}
                {(totalScore - totalPreviousScore).toFixed(2)}
              </span>
            </div>
          )}
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-emerald-400" />
            <span className="text-sm font-medium text-slate-300">指标数量</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400">{results.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {results.map((result) => {
          const diff = result.previousScore !== undefined ? result.score - result.previousScore : 0
          const isIncrease = diff > 0
          const isDecrease = diff < 0

          return (
            <div key={result.id} className="card">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-amber-500" />
                <span className="text-sm font-medium text-slate-200">{result.targetName}</span>
              </div>
              <div className="text-3xl font-bold text-amber-500 mb-1">{result.score.toFixed(2)}</div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500">
                  权重: {(result.weight * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-600">|</span>
                <span className="text-xs text-slate-400">
                  加权: {result.weightedScore.toFixed(2)}
                </span>
                {diff !== 0 && (
                  <span
                    className={`text-xs inline-flex items-center gap-0.5 ${
                      isIncrease ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isIncrease ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isIncrease ? '+' : ''}{diff.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${(result.weight / maxWeight) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="text-sm font-medium text-slate-300 mb-4">权重分布</h3>
          <div className="space-y-3">
            {results.map((result) => (
              <div key={result.id} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-24 truncate">{result.targetName}</span>
                <div className="flex-1 h-6 bg-slate-700 rounded overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded transition-all duration-500"
                    style={{ width: `${(result.weight / maxWeight) * 100}%` }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-300">
                    {(result.weight * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-slate-300 mb-4">加权得分详情</h3>
          <div className="space-y-3">
            {results.map((result) => {
              const maxWeighted = Math.max(...results.map((r) => r.weightedScore), 1)
              return (
                <div key={result.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-24 truncate">{result.targetName}</span>
                  <div className="flex-1 h-6 bg-slate-700 rounded overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded transition-all duration-500"
                      style={{ width: `${(result.weightedScore / maxWeighted) * 100}%` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-300">
                      {result.weightedScore.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {hasComparison && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50">
            <span className="text-sm font-medium text-slate-300">更新前后对比</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">指标</th>
                  <th className="px-4 py-3 text-right">更新前得分</th>
                  <th className="px-4 py-3 text-right">更新后得分</th>
                  <th className="px-4 py-3 text-right">变化</th>
                  <th className="px-4 py-3 text-right">更新前加权</th>
                  <th className="px-4 py-3 text-right">更新后加权</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const prevScore = result.previousScore ?? 0
                  const prevWeighted = result.previousWeightedScore ?? 0
                  const scoreDiff = result.score - prevScore
                  return (
                    <tr key={result.id} className="table-row">
                      <td className="px-4 py-3 text-slate-300 font-medium">{result.targetName}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{prevScore.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{result.score.toFixed(2)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          scoreDiff > 0 ? 'text-emerald-400' : scoreDiff < 0 ? 'text-rose-400' : 'text-slate-500'
                        }`}
                      >
                        {scoreDiff > 0 ? '+' : ''}{scoreDiff.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">{prevWeighted.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{result.weightedScore.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={updateResults}
          disabled={loading || stepStatus === 'updated'}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {stepStatus === 'updated' ? '结果已更新' : '更新结果'}
        </button>
      </div>
    </div>
  )
}
