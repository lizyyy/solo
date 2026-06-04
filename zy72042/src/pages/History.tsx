import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Trophy, AlertTriangle, Trash2, Edit3 } from 'lucide-react'
import { useHistoryStore } from '@/stores/historyStore'
import { useSupplementStore } from '@/stores/supplementStore'
import { LEVELS } from '@/data/levels'

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  completed: { label: '通关', className: 'bg-safe-green/20 text-safe-green' },
  failed: { label: '失败', className: 'bg-risk-red/20 text-risk-red' },
  paused: { label: '暂停', className: 'bg-risk-yellow/20 text-risk-yellow' },
}

export default function History() {
  const sessions = useHistoryStore((s) => s.sessions)
  const loadSessions = useHistoryStore((s) => s.loadSessions)
  const deleteSession = useHistoryStore((s) => s.deleteSession)
  const loadSupplements = useSupplementStore((s) => s.loadAll)
  const getSessionWithSupplements = useSupplementStore((s) => s.getSessionWithSupplements)
  const hasSupplements = useSupplementStore((s) => s.hasSupplements)

  useEffect(() => {
    loadSessions()
    loadSupplements()
  }, [loadSessions, loadSupplements])

  const enhancedSessions = useMemo(() => {
    return sessions.map(raw => {
      const supplemented = getSessionWithSupplements(raw.id) ?? raw
      return {
        raw,
        supplemented,
        hasSupplements: hasSupplements(raw.id),
      }
    })
  }, [sessions, getSessionWithSupplements, hasSupplements])

  const sorted = [...enhancedSessions].sort((a, b) => b.supplemented.startedAt - a.supplemented.startedAt)

  return (
    <div className="pt-20 bg-cafe-cream min-h-screen">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        <h1 className="font-serif text-3xl text-cafe-brown">历史记录</h1>

        {sorted.length === 0 ? (
          <div className="card-cafe text-center py-12">
            <Clock className="w-10 h-10 mx-auto text-cafe-brown/20 mb-3" />
            <p className="text-cafe-brown/50 mb-4">暂无游戏记录</p>
            <Link to="/" className="btn-primary">开始游戏</Link>
          </div>
        ) : (
          sorted.map(({ raw, supplemented, hasSupplements }) => {
            const level = LEVELS.find((l) => l.id === supplemented.levelId)
            const badge = STATUS_BADGES[supplemented.status] ?? STATUS_BADGES.paused
            const hasExceptions = (supplemented.exceptions ?? []).length > 0
            const scoreChanged = hasSupplements && supplemented.currentScore !== raw.currentScore
            const riskChanged = hasSupplements && supplemented.currentRisk !== raw.currentRisk

            return (
              <div key={supplemented.id} className="card-cafe flex items-center justify-between gap-4">
                <Link
                  to={`/summary/${supplemented.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-serif font-bold text-cafe-brown">
                      {level?.name ?? supplemented.levelId}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                    {hasSupplements && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-data-blue/10 text-data-blue">
                        <Edit3 className="w-3 h-3" />
                        已补录
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-cafe-brown/50 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {supplemented.currentScore.toFixed(1)}分
                      {scoreChanged && (
                        <span className="text-risk-yellow">(原{raw.currentScore.toFixed(1)}分)</span>
                      )}
                    </span>
                    <span>
                      风险: {(supplemented.currentRisk * 100).toFixed(1)}%
                      {riskChanged && (
                        <span className="text-risk-yellow">(原{(raw.currentRisk * 100).toFixed(1)}%)</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(supplemented.startedAt).toLocaleString()}
                    </span>
                    {hasExceptions && (
                      <span className="flex items-center gap-1 text-risk-yellow">
                        <AlertTriangle className="w-3 h-3" />
                        例外
                      </span>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-1">
                  <Link
                    to={`/supplement/${supplemented.id}`}
                    className="p-2 rounded-lg hover:bg-data-blue/10 text-cafe-brown/30 hover:text-data-blue transition-colors shrink-0"
                    title="补录"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Link>
                  <button
                    className="p-2 rounded-lg hover:bg-risk-red/10 text-cafe-brown/30 hover:text-risk-red transition-colors shrink-0"
                    onClick={() => deleteSession(supplemented.id)}
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
