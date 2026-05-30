import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Trophy, AlertTriangle, GitBranch, Clock, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import { useGameStore } from '@/store/gameStore'
import { RISK_CATEGORY_LABELS, DECISION_TYPE_LABELS, RiskCategory, DecisionType } from '@/types'

const DECISION_COLORS: Record<DecisionType, string> = {
  path_planning: 'bg-amber-500/30 border-amber-500/50 text-amber-400',
  task_priority: 'bg-blue-500/30 border-blue-500/50 text-blue-400',
  time_pressure: 'bg-red-500/30 border-red-500/50 text-red-400',
}

const DECISION_DOT: Record<DecisionType, string> = {
  path_planning: 'bg-amber-500',
  task_priority: 'bg-blue-500',
  time_pressure: 'bg-red-500',
}

const RISK_COLORS: Record<RiskCategory, string> = {
  route_cross: 'bg-red-500/20 border-red-500/30 text-red-400',
  delivery_timeout: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
  missed_cleaning: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
}

const RISK_DOT: Record<RiskCategory, string> = {
  route_cross: 'bg-red-500',
  delivery_timeout: 'bg-yellow-500',
  missed_cleaning: 'bg-purple-500',
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

interface TimelineEntry {
  id: string
  timestamp: number
  type: 'decision' | 'risk'
  decisionType?: DecisionType
  riskCategory?: RiskCategory
  title: string
  detail: string
  extra?: string
}

export default function ReplayPage() {
  const navigate = useNavigate()
  const gameResult = useGameStore(s => s.gameResult)
  const riskRecords = useGameStore(s => s.riskRecords)
  const decisionLogs = useGameStore(s => s.decisionLogs)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const timeline: TimelineEntry[] = useMemo(() => {
    const decisions: TimelineEntry[] = decisionLogs.map(d => ({
      id: d.id,
      timestamp: d.timestamp,
      type: 'decision' as const,
      decisionType: d.decisionType,
      title: DECISION_TYPE_LABELS[d.decisionType],
      detail: d.reason,
      extra: d.consequence,
    }))
    const risks: TimelineEntry[] = riskRecords.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      type: 'risk' as const,
      riskCategory: r.category,
      title: RISK_CATEGORY_LABELS[r.category],
      detail: r.description,
      extra: r.explanation,
    }))
    return [...decisions, ...risks].sort((a, b) => a.timestamp - b.timestamp)
  }, [decisionLogs, riskRecords])

  const topExplanations = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const r of riskRecords) {
      freq[r.explanation] = (freq[r.explanation] || 0) + 1
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [riskRecords])

  const mostCommonCategory = useMemo(() => {
    const freq: Record<RiskCategory, number> = { route_cross: 0, delivery_timeout: 0, missed_cleaning: 0 }
    for (const r of riskRecords) freq[r.category]++
    const max = Math.max(freq.route_cross, freq.delivery_timeout, freq.missed_cleaning)
    if (max === 0) return null
    return (Object.entries(freq).find(([, v]) => v === max) as [RiskCategory, number])?.[0] ?? null
  }, [riskRecords])

  if (!gameResult) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] text-white flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-12 h-12 text-white/20" />
        <p className="text-white/40">暂无游戏记录，请先完成一局游戏</p>
        <Link to="/" className="text-[#F0A500] text-sm hover:underline">返回首页</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-white p-4 pb-8">
      <header className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#4A90D9]" />
          复盘回放
        </h1>
      </header>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-[#F0A500]" />
          <span className="text-lg font-bold">总分: {gameResult.score}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            <div className="text-xs text-red-400 mb-1">路线交叉</div>
            <div className="text-sm font-bold">-{gameResult.routeCrossPenalty}</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
            <div className="text-xs text-yellow-400 mb-1">出餐超时</div>
            <div className="text-sm font-bold">-{gameResult.timeoutPenalty}</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2">
            <div className="text-xs text-purple-400 mb-1">清洁漏做</div>
            <div className="text-sm font-bold">-{gameResult.missedCleanPenalty}</div>
          </div>
        </div>
        <div className="flex justify-center gap-6 mt-3 text-xs text-white/40">
          <span>风险数: {gameResult.totalRisks}</span>
          <span>决策数: {gameResult.decisionsCount}</span>
        </div>
      </div>

      <h2 className="text-sm font-bold text-white/60 mb-3 flex items-center gap-2">
        <GitBranch className="w-4 h-4" />
        决策与风险时间线
      </h2>

      <div className="relative ml-4">
        <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-white/10" />
        <div className="space-y-3">
          {timeline.map(entry => {
            const isExpanded = expandedId === entry.id
            const isDecision = entry.type === 'decision'
            const colorClass = isDecision
              ? DECISION_COLORS[entry.decisionType!]
              : RISK_COLORS[entry.riskCategory!]
            const dotColor = isDecision
              ? DECISION_DOT[entry.decisionType!]
              : RISK_DOT[entry.riskCategory!]

            return (
              <div key={entry.id} className="relative pl-6 animate-fade-in">
                <div className={`absolute left-0 top-2 w-[14px] h-[14px] rounded-full border-2 ${dotColor} border-[#1A1A2E] z-10`} />
                <div
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${colorClass}`}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{entry.title}</span>
                      <span className="text-[10px] opacity-60">{formatTime(entry.timestamp)}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 opacity-50" /> : <ChevronDown className="w-3.5 h-3.5 opacity-50" />}
                  </div>
                  <p className="text-xs mt-1 opacity-70">{entry.detail}</p>
                  {isExpanded && entry.extra && (
                    <div className="mt-2 text-xs bg-black/20 rounded px-2 py-1.5 opacity-60">
                      {entry.extra}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {timeline.length === 0 && (
            <p className="text-center text-white/30 text-sm py-8">暂无时间线数据</p>
          )}
        </div>
      </div>

      <h2 className="text-sm font-bold text-white/60 mt-6 mb-3 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-[#F0A500]" />
        关键教训
      </h2>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        {mostCommonCategory && (
          <p className="text-sm mb-3">
            最常见风险类型:
            <span className={`ml-1 font-bold ${
              mostCommonCategory === 'route_cross' ? 'text-red-400' :
              mostCommonCategory === 'delivery_timeout' ? 'text-yellow-400' : 'text-purple-400'
            }`}>
              {RISK_CATEGORY_LABELS[mostCommonCategory]}
            </span>
          </p>
        )}
        {topExplanations.length > 0 ? (
          <div className="space-y-2">
            {topExplanations.map(([explanation, count], i) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-black/20 rounded-lg px-3 py-2">
                <span className="text-[#F0A500] font-bold shrink-0">#{i + 1}</span>
                <span className="text-white/60">{explanation}</span>
                <span className="text-white/30 shrink-0">×{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/30">无风险记录</p>
        )}
      </div>
    </div>
  )
}
