import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore.js'
import { ArrowLeft, Trophy, Medal, Crown, ChevronDown } from 'lucide-react'
import type { LeaderboardEntry } from '../../shared/types.js'

const MAX_SCORE = 100

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const percentage = Math.min(100, Math.max(0, (score / MAX_SCORE) * 100))
  return (
    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Medal className="w-5 h-5" style={{ color: '#EAB308' }} />
  }
  if (rank === 2) {
    return <Medal className="w-5 h-5" style={{ color: '#94A3B8' }} />
  }
  if (rank === 3) {
    return <Medal className="w-5 h-5" style={{ color: '#D97706' }} />
  }
  return <span className="w-5 text-center font-mono text-slate-400">{rank}</span>
}

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isFirst = rank === 1
  const isSecond = rank === 2
  const isThird = rank === 3

  const cardClass = isFirst
    ? 'flex-1 transform scale-110 order-2 z-10 bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/50'
    : isSecond
    ? 'flex-1 order-1 transform scale-0.95 translate-y-4 border-slate-400/50 bg-slate-400/5'
    : 'flex-1 order-3 transform scale-0.95 translate-y-4 border-amber-600/50 bg-amber-600/5'

  const medalColor = isFirst ? '#EAB308' : isSecond ? '#94A3B8' : '#D97706'

  return (
    <div className={`rounded-xl border p-5 flex flex-col items-center text-center ${cardClass}`}>
      {isFirst && <Crown className="w-8 h-8 mb-2" style={{ color: '#EAB308' }} />}
      <div className="flex items-center gap-2 mb-2">
        <Medal className="w-6 h-6" style={{ color: medalColor }} />
        <span className="text-xl font-bold" style={{ color: medalColor }}>第{rank}名</span>
      </div>
      <div className="text-lg font-semibold text-white mb-1">{entry.playerName}</div>
      <div className="text-4xl font-bold text-white mb-2">{entry.totalScore}</div>
      <div className="text-sm text-slate-400">{entry.scenarioName}</div>
    </div>
  )
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const { leaderboard, scenarios, loading, fetchLeaderboard, fetchScenarios } = useGameStore()
  const [scenarioFilter, setScenarioFilter] = useState<string>('')

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  useEffect(() => {
    fetchLeaderboard(scenarioFilter || undefined)
  }, [scenarioFilter, fetchLeaderboard])

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  return (
    <div className="bg-slate-900 min-h-screen text-white">
      <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">返回</span>
              </button>
              <div>
                <h1 className="text-xl font-bold">排行榜</h1>
                <p className="text-sm text-slate-400">全班同学的最佳成绩</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-2">场景筛选</label>
              <div className="relative">
                <select
                  value={scenarioFilter}
                  onChange={(e) => setScenarioFilter(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 pr-10"
                >
                  <option value="">全部场景</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="text-sm text-slate-400">
              共 <span className="font-bold text-white">{leaderboard.length}</span> 条记录
            </div>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="w-16 h-16 text-slate-600 mb-4" />
            <div className="text-xl text-slate-400 mb-2">暂无排行数据</div>
            <div className="text-sm text-slate-500">开始挑战后，排行榜数据将显示在这里</div>
          </div>
        ) : (
          <>
            {top3.length > 0 && (
              <div className="flex items-end gap-4 mb-10">
                {top3.map((entry, index) => (
                  <PodiumCard key={entry.playerName} entry={entry} rank={index + 1} />
                ))}
              </div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">排名</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">玩家</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">场景</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">车辆</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">行人</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">公交</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">总分</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">状态</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr key={`${entry.playerName}-${index}`} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <RankDisplay rank={index + 1} />
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{entry.playerName}</td>
                        <td className="px-4 py-3 text-slate-300">{entry.scenarioName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ScoreBar score={entry.vehicleScore} color="bg-green-500" />
                            <span className="text-sm font-mono text-slate-400">{entry.vehicleScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ScoreBar score={entry.pedestrianScore} color="bg-orange-500" />
                            <span className="text-sm font-mono text-slate-400">{entry.pedestrianScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ScoreBar score={entry.busScore} color="bg-blue-500" />
                            <span className="text-sm font-mono text-slate-400">{entry.busScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xl font-bold text-emerald-400">{entry.totalScore}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-lg">{entry.passed ? '✓' : '✗'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{formatDate(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
