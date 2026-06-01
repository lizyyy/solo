import { useParams, useNavigate, Link } from 'react-router-dom'
import { useHistoryStore } from '@/stores/historyStore'
import { LEVELS } from '@/data/levels'
import StatsOverview from '@/components/summary/StatsOverview'
import ExceptionTable from '@/components/summary/ExceptionTable'
import HistoryTimeline from '@/components/summary/HistoryTimeline'

export default function Summary() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const getSession = useHistoryStore((s) => s.getSession)
  const session = sessionId ? getSession(sessionId) : undefined

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

  return (
    <div className="pt-20 bg-cafe-cream min-h-screen">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-cafe-brown">游戏汇总</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-cafe-brown/60">
              <span>关卡: {level?.name ?? session.levelId}</span>
              <span>·</span>
              <span>分数: {session.currentScore.toFixed(0)}</span>
              <span>·</span>
              <span className={statusColor}>{statusLabel}</span>
            </div>
          </div>
        </div>

        <StatsOverview session={session} actions={actions} exceptions={exceptions} />

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
