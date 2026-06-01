import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useHistoryStore } from '@/stores/historyStore'
import { useSupplementStore } from '@/stores/supplementStore'
import { LEVELS } from '@/data/levels'
import SupplementForm from '@/components/supplement/SupplementForm'
import DiffViewer from '@/components/supplement/DiffViewer'

export default function Supplement() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const getSession = useHistoryStore((s) => s.getSession)
  const loadSessions = useHistoryStore((s) => s.loadSessions)
  const saveBaseline = useSupplementStore((s) => s.saveBaseline)
  const getBaselineSnapshot = useSupplementStore((s) => s.getBaselineSnapshot)
  const getSupplements = useSupplementStore((s) => s.getSupplements)
  const [refreshKey, setRefreshKey] = useState(0)

  const session = sessionId ? getSession(sessionId) : undefined

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (session) {
      saveBaseline(session.id, session)
    }
  }, [session?.id])

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
  const baseline = getBaselineSnapshot(session.id)
  const supplements = getSupplements(session.id)

  const statusLabel = session.status === 'completed' ? '通关' : '失败'
  const statusColor = session.status === 'completed' ? 'text-safe-green' : 'text-risk-red'

  return (
    <div className="pt-20 bg-cafe-cream min-h-screen">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-6 h-6 text-cafe-brown" />
            <h1 className="font-serif text-3xl text-cafe-brown">补录工作台</h1>
          </div>
          <p className="text-sm text-cafe-brown/50">活动策划阿蓝专用</p>
        </div>

        <div className="card-cafe mb-6">
          <div className="flex items-center gap-4 text-sm text-cafe-brown/70">
            <span>关卡: {level?.name ?? session.levelId}</span>
            <span>·</span>
            <span>得分: {session.currentScore.toFixed(0)}</span>
            <span>·</span>
            <span>风险: {(session.currentRisk * 100).toFixed(1)}%</span>
            <span>·</span>
            <span className={statusColor}>{statusLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SupplementForm
            sessionId={session.id}
            onAdded={() => setRefreshKey((k) => k + 1)}
          />
          <DiffViewer
            key={refreshKey}
            baseline={baseline ?? null}
            currentSession={session}
            supplements={supplements}
          />
        </div>

        <div className="mt-6">
          <button
            className="btn-secondary"
            onClick={() => navigate(`/summary/${session.id}`)}
          >
            返回汇总
          </button>
        </div>
      </div>
    </div>
  )
}
