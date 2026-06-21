import { useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { PieChart } from 'lucide-react'
import { useHistoryStore } from '@/stores/historyStore'
import { useSupplementStore } from '@/stores/supplementStore'
import { LEVELS } from '@/data/levels'
import { FUND_ASSETS, FUND_CATEGORY_COLORS } from '@/data/funds'
import StatsOverview from '@/components/summary/StatsOverview'
import ExceptionTable from '@/components/summary/ExceptionTable'
import HistoryTimeline from '@/components/summary/HistoryTimeline'

export default function Summary() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const getSession = useHistoryStore((s) => s.getSession)
  const loadSessions = useHistoryStore((s) => s.loadSessions)
  const loadSupplements = useSupplementStore((s) => s.loadAll)
  const getSessionWithSupplements = useSupplementStore((s) => s.getSessionWithSupplements)
  const hasSupplements = useSupplementStore((s) => s.hasSupplements)

  const rawSession = sessionId ? getSession(sessionId) : undefined
  const session = useMemo(() => {
    if (!sessionId) return undefined
    return getSessionWithSupplements(sessionId) ?? rawSession
  }, [sessionId, rawSession, getSessionWithSupplements])

  const holdingsView = useMemo(() => {
    if (!session) return []
    const fundMap = new Map(FUND_ASSETS.map((f) => [f.id, f]))
    const totalRatio = session.holdings.reduce((s, h) => s + h.ratio, 0)
    return session.holdings.map((h) => {
      const fund = fundMap.get(h.fundId)
      return {
        fundId: h.fundId,
        name: fund?.name ?? h.fundId,
        category: fund?.category ?? 'mixed',
        ratio: h.ratio,
        ratioPct: totalRatio > 0 ? (h.ratio / totalRatio) * 100 : 0,
      }
    })
  }, [session])

  useEffect(() => {
    loadSessions()
    loadSupplements()
  }, [loadSessions, loadSupplements])

  if (!session) {
    return (
      <div className="pt-20 bg-cafe-cream min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-cafe-brown/60 text-lg mb-4">未找到游戏记录</p>
          <Link to="/" className="btn-primary">返回首页</Link>
        </div>
      </div>
    )
  }

  const level = LEVELS.find((l) => l.id === session.levelId)
  const statusLabel = session.status === 'completed' ? '通关' : '失败'
  const statusColor = session.status === 'completed' ? 'text-safe-green' : 'text-risk-red'
  const actions = session.actions ?? []
  const exceptions = session.exceptions ?? []
  const supplemented = hasSupplements(session.id)

  return (
    <div className="pt-20 bg-cafe-cream min-h-screen">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-cafe-brown">游戏汇总</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-cafe-brown/60">
              <span>关卡: {level?.name ?? session.levelId}</span>
              <span>·</span>
              <span>分数: {session.currentScore.toFixed(1)}</span>
              <span>·</span>
              <span>风险: {(session.currentRisk * 100).toFixed(1)}%</span>
              <span>·</span>
              <span className={statusColor}>{statusLabel}</span>
              {supplemented && (
                <>
                  <span>·</span>
                  <span className="text-data-blue">已补录</span>
                </>
              )}
            </div>
          </div>
        </div>

        <StatsOverview session={session} actions={actions} exceptions={exceptions} />

        <div className="card-cafe">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-data-blue" />
            <span className="font-medium text-cafe-brown text-sm">最终持仓组合</span>
            {supplemented && (
              <span className="text-xs bg-data-blue/10 text-data-blue px-1.5 py-0.5 rounded">
                已应用补录
              </span>
            )}
          </div>
          {holdingsView.length === 0 ? (
            <p className="text-sm text-cafe-brown/40">（空持仓）</p>
          ) : (
            <div className="space-y-2">
              {holdingsView.map((h) => (
                <div key={h.fundId} className="flex items-center gap-3">
                  <div
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: FUND_CATEGORY_COLORS[h.category] ?? '#795548' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-cafe-brown font-medium">{h.name}</span>
                      <span className="text-xs text-cafe-brown/60">
                        {(h.ratio * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-cafe-latte/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${h.ratioPct}%`,
                          backgroundColor: FUND_CATEGORY_COLORS[h.category] ?? '#795548',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-cafe-latte/40 text-xs text-cafe-brown/50">
                合计配比:{' '}
                <span className="text-cafe-brown/70 font-medium">
                  {(holdingsView.reduce((s, h) => s + h.ratio, 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <ExceptionTable exceptions={exceptions} />

        <HistoryTimeline actions={actions} />

        <div className="flex gap-3">
          <button
            className="btn-primary"
            onClick={() => navigate(`/supplement/${session.id}`)}
          >
            查看补录工作台
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate(`/conflict/${session.id}`)}
          >
            查看冲突
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate('/')}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}
