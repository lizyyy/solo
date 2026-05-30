import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore.js'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  RotateCcw,
  History,
  Home,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'

const DIMENSION_LABELS: Record<string, string> = {
  vehicle: '车流',
  pedestrian: '行人',
  bus: '公交',
}

const DIMENSION_COLORS: Record<string, { bar: string; text: string }> = {
  vehicle: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
  pedestrian: { bar: 'bg-orange-500', text: 'text-orange-400' },
  bus: { bar: 'bg-blue-500', text: 'text-blue-400' },
}

const RISK_CATEGORY_LABELS: Record<string, string> = {
  phase_conflict: '相位冲突风险',
  pedestrian_wait: '行人等待过久风险',
  bus_priority: '公交优先漏算风险',
}

const RISK_LEVEL_STYLES: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

const RISK_LEVEL_LABELS: Record<string, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
}

const MOVEMENT_LABELS: Record<string, string> = {
  north: '北',
  south: '南',
  east: '东',
  west: '西',
  straight: '直行',
  left: '左转',
  right: '右转',
  bus: '公交',
}

function getScoreBadge(score: number) {
  if (score >= 80) {
    return { label: '表现优秀', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
  }
  if (score >= 60) {
    return { label: '有待改进', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
  }
  return { label: '严重不足', className: 'bg-red-500/20 text-red-400 border-red-500/30' }
}

function getDimensionReason(score: number, dimension: string): string {
  const label = DIMENSION_LABELS[dimension]
  if (score >= 80) {
    return `${label}通行效率优秀，配置合理`
  }
  if (score >= 60) {
    return `${label}配置基本可行，但仍有优化空间`
  }
  return `${label}配置存在明显问题，需重点调整`
}

export default function Result() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { gameResult, loading, error, fetchGameResult, exportGame, resetGame } = useGameStore()
  const [showPhases, setShowPhases] = useState(false)

  useEffect(() => {
    if (gameId) {
      fetchGameResult(gameId)
    }
  }, [gameId, fetchGameResult])

  const handlePlayAgain = () => {
    if (gameResult) {
      resetGame()
      navigate(`/game/${gameResult.scenarioId}`)
    }
  }

  const handleExport = () => {
    if (gameId) {
      exportGame(gameId)
    }
  }

  if (loading && !gameResult) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (error || !gameResult) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white">
        <div className="text-xl text-red-400">{error || '结果未找到'}</div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          <Home className="w-4 h-4" />
          返回首页
        </button>
      </div>
    )
  }

  const dimensions = [
    { key: 'vehicle', score: gameResult.vehicleScore },
    { key: 'pedestrian', score: gameResult.pedestrianScore },
    { key: 'bus', score: gameResult.busScore },
  ]

  const phaseConflicts = gameResult.risks.filter((r) => r.category === 'phase_conflict')
  const pedestrianWaits = gameResult.risks.filter((r) => r.category === 'pedestrian_wait')
  const busPriorities = gameResult.risks.filter((r) => r.category === 'bus_priority')

  const riskGroups = [
    { key: 'phase_conflict', items: phaseConflicts },
    { key: 'pedestrian_wait', items: pedestrianWaits },
    { key: 'bus_priority', items: busPriorities },
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className={`bg-gradient-to-r ${gameResult.passed ? 'from-emerald-600 to-emerald-700' : 'from-red-600 to-red-700'} py-12 px-4`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            {gameResult.passed ? (
              <CheckCircle className="w-12 h-12 text-white" />
            ) : (
              <XCircle className="w-12 h-12 text-white" />
            )}
            <h1 className="text-5xl font-bold">
              {gameResult.passed ? '✓ 方案通过' : '✗ 方案未通过'}
            </h1>
          </div>
          <div className="text-xl text-white/90">
            {gameResult.scenarioName} · {gameResult.playerName}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {dimensions.map((dim) => {
            const colors = DIMENSION_COLORS[dim.key]
            const badge = getScoreBadge(dim.score)
            return (
              <div key={dim.key} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold text-slate-200">{DIMENSION_LABELS[dim.key]}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className={`text-4xl font-bold ${colors.text}`}>{dim.score}</span>
                  <span className="text-slate-500">/100</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
                  <div className={`h-full ${colors.bar} transition-all duration-500`} style={{ width: `${dim.score}%` }} />
                </div>
                <p className="text-sm text-slate-400">{getDimensionReason(dim.score, dim.key)}</p>
              </div>
            )
          })}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8 text-center">
          <div className="text-5xl font-bold text-white mb-2">
            总分: {gameResult.totalScore}/300
          </div>
          <div className="text-slate-400">
            及格线: {gameResult.passThreshold}/300
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-slate-100">胜败原因</h2>
          <div className="space-y-2">
            {gameResult.passed
              ? gameResult.winReasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{reason}</span>
                  </div>
                ))
              : gameResult.loseReasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{reason}</span>
                  </div>
                ))}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-8">
          <h2 className="text-xl font-semibold mb-5 text-slate-100">风险分项说明</h2>
          <div className="space-y-6">
            {riskGroups.map((group) => (
              <div key={group.key}>
                <h3 className="text-lg font-medium mb-3 text-slate-200">
                  {RISK_CATEGORY_LABELS[group.key]}
                </h3>
                {group.items.length > 0 ? (
                  <div className="space-y-3">
                    {group.items.map((risk, i) => (
                      <div key={i} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                        <div className="flex items-start gap-3 mb-2">
                          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${RISK_LEVEL_STYLES[risk.level]}`}>
                                {RISK_LEVEL_LABELS[risk.level]}
                              </span>
                            </div>
                            <p className="text-slate-300">{risk.description}</p>
                          </div>
                        </div>
                        <div className="bg-slate-700/50 border-l-4 border-emerald-500 italic text-slate-300 p-4 rounded">
                          {risk.businessExplanation}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    未检测到此类风险
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl mb-8 overflow-hidden">
          <button
            onClick={() => setShowPhases(!showPhases)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-700/30 transition-colors"
          >
            <h2 className="text-xl font-semibold text-slate-100">相位配置详情</h2>
            {showPhases ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>
          {showPhases && (
            <div className="p-5 pt-0 space-y-4">
              {gameResult.phaseConfig.map((phase, i) => (
                <div key={phase.id} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-slate-200">{phase.name}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-400">绿 {phase.greenSeconds}s</span>
                      <span className="text-yellow-400">黄 {phase.yellowSeconds}s</span>
                      <span className="text-red-400">红清 {phase.redClearanceSeconds}s</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {phase.movements.map((m, j) => {
                      const dirPart = m.approachId.split('-')[1]
                      const dirLabel = MOVEMENT_LABELS[dirPart] || m.approachId
                      return (
                        <span key={j} className="px-2.5 py-1 bg-slate-600/50 rounded text-sm text-slate-300">
                          {dirLabel}{MOVEMENT_LABELS[m.laneType]}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={handlePlayAgain}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            再来一局
          </button>
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            <History className="w-4 h-4" />
            查看历史
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            导出数据
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-2.5 border border-slate-600 hover:border-slate-500 hover:bg-slate-800 rounded-lg font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}
