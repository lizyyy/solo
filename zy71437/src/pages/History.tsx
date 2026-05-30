import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore.js'
import type { Game } from '../../shared/types.js'
import {
  ArrowLeft,
  Trophy,
  Target,
  TrendingUp,
  Star,
  Download,
  Eye,
  Filter,
  Clock,
  TrafficCone,
  CheckCircle,
  XCircle,
} from 'lucide-react'

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  hard: 'bg-red-500/20 text-red-400',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

const SCORE_COLORS: Record<string, string> = {
  vehicle: 'bg-emerald-500',
  pedestrian: 'bg-orange-500',
  bus: 'bg-blue-500',
}

const SCORE_LABELS: Record<string, string> = {
  vehicle: '车',
  pedestrian: '人',
  bus: '公',
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function exportAllToCSV(games: Game[]) {
  const headers = 'id,scenario_id,player_name,vehicle_score,pedestrian_score,bus_score,total_score,passed,created_at'
  const rows = games.map((g) => {
    const passed = g.passed ? 1 : 0
    return `${g.id},${g.scenarioId},${g.playerName},${g.vehicleScore},${g.pedestrianScore},${g.busScore},${g.totalScore},${passed},${g.createdAt}`
  })
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `history-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function History() {
  const navigate = useNavigate()
  const {
    playerName,
    games,
    scenarios,
    loading,
    fetchHistory,
    fetchScenarios,
    exportGame,
  } = useGameStore()

  const [filterPlayerName, setFilterPlayerName] = useState(playerName)
  const [scenarioFilter, setScenarioFilter] = useState<string>('all')
  const [passFilter, setPassFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date_desc')

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  useEffect(() => {
    fetchHistory(filterPlayerName || undefined)
  }, [filterPlayerName, fetchHistory])

  const scenarioMap = useMemo(() => {
    const map: Record<string, { name: string; difficulty: string }> = {}
    scenarios.forEach((s) => {
      map[s.id] = { name: s.name, difficulty: s.difficulty }
    })
    return map
  }, [scenarios])

  const uniqueScenarioIds = useMemo(() => {
    const ids = new Set<string>()
    games.forEach((g) => ids.add(g.scenarioId))
    return Array.from(ids)
  }, [games])

  const filteredGames = useMemo(() => {
    let result = [...games]

    if (scenarioFilter !== 'all') {
      result = result.filter((g) => g.scenarioId === scenarioFilter)
    }

    if (passFilter === 'passed') {
      result = result.filter((g) => g.passed)
    } else if (passFilter === 'failed') {
      result = result.filter((g) => !g.passed)
    }

    switch (sortBy) {
      case 'date_asc':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'score_desc':
        result.sort((a, b) => b.totalScore - a.totalScore)
        break
      case 'score_asc':
        result.sort((a, b) => a.totalScore - b.totalScore)
        break
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    return result
  }, [games, scenarioFilter, passFilter, sortBy])

  const stats = useMemo(() => {
    const totalGames = games.length
    if (totalGames === 0) {
      return {
        totalGames: 0,
        passRate: 0,
        avgScore: 0,
        bestScore: 0,
      }
    }
    const passedGames = games.filter((g) => g.passed).length
    const passRate = Math.round((passedGames / totalGames) * 100)
    const totalScore = games.reduce((sum, g) => sum + g.totalScore, 0)
    const avgScore = Math.round(totalScore / totalGames)
    const bestScore = Math.max(...games.map((g) => g.totalScore))
    return {
      totalGames,
      passRate,
      avgScore,
      bestScore,
    }
  }, [games])

  const handleExportAll = () => {
    if (filteredGames.length === 0) {
      alert('暂无数据可导出')
      return
    }
    exportAllToCSV(filteredGames)
  }

  const handleExportGame = (gameId: string) => {
    exportGame(gameId)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">返回</span>
              </button>
              <h1 className="text-xl font-bold">历史战绩</h1>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={filterPlayerName}
                onChange={(e) => setFilterPlayerName(e.target.value)}
                placeholder="输入玩家名筛选"
                className="w-40 sm:w-56 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handleExportAll}
                disabled={loading || filteredGames.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">导出全部</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Trophy className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-slate-400 text-sm">总对局</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalGames}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Target className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-slate-400 text-sm">通过率</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{stats.passRate}%</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-slate-400 text-sm">平均分</span>
            </div>
            <div className="text-3xl font-bold text-orange-400">{stats.avgScore}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-slate-400 text-sm">最高分</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{stats.bestScore}</div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-slate-400" />
            <span className="font-medium">筛选与排序</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">场景</label>
              <select
                value={scenarioFilter}
                onChange={(e) => setScenarioFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">全部场景</option>
                {uniqueScenarioIds.map((id) => (
                  <option key={id} value={id}>
                    {scenarioMap[id]?.name || id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">状态</label>
              <select
                value={passFilter}
                onChange={(e) => setPassFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">全部</option>
                <option value="passed">通过</option>
                <option value="failed">未通过</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">排序</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="date_desc">时间倒序</option>
                <option value="date_asc">时间正序</option>
                <option value="score_desc">得分倒序</option>
                <option value="score_asc">得分正序</option>
              </select>
            </div>
          </div>
        </div>

        {filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <TrafficCone className="w-16 h-16 text-slate-600 mb-4" />
            <div className="text-xl text-slate-400 mb-2">暂无对局记录</div>
            <div className="text-sm text-slate-500">开始挑战后，你的战绩将显示在这里</div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-700" />
            <div className="space-y-6">
              {filteredGames.map((game) => {
                const scenario = scenarioMap[game.scenarioId]
                return (
                  <div key={game.id} className="relative pl-12">
                    <div className="absolute left-2 top-6 w-5 h-5 bg-slate-800 border-4 border-slate-600 rounded-full z-10" />
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                        <div className="flex items-start gap-3">
                          <Clock className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0" />
                          <div>
                            <div className="text-sm text-slate-400">{formatDateTime(game.createdAt)}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-lg font-semibold">{scenario?.name || game.scenarioId}</span>
                              {scenario && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_STYLES[scenario.difficulty]}`}>
                                  {DIFFICULTY_LABELS[scenario.difficulty]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                              game.passed
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {game.passed ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            {game.passed ? '通过' : '未通过'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {(['vehicle', 'pedestrian', 'bus'] as const).map((dim) => (
                              <div key={dim} className="flex items-center gap-1">
                                <div
                                  className={`w-8 h-8 ${SCORE_COLORS[dim]} rounded-full flex items-center justify-center text-xs font-bold text-white`}
                                >
                                  {SCORE_LABELS[dim]}
                                </div>
                                <span className="text-sm font-mono text-slate-300">
                                  {game[`${dim}Score` as 'vehicleScore' | 'pedestrianScore' | 'busScore']}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-slate-500">总分</div>
                            <div className="text-3xl font-bold text-white">{game.totalScore}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/result/${game.id}`)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline">查看详情</span>
                            </button>
                            <button
                              onClick={() => handleExportGame(game.id)}
                              disabled={loading}
                              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline">导出</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
