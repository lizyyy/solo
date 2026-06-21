import { useEffect, useState, useMemo } from 'react'
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
  const loadSupplements = useSupplementStore((s) => s.loadAll)
  const saveBaseline = useSupplementStore((s) => s.saveBaseline)
  const getBaselineSnapshot = useSupplementStore((s) => s.getBaselineSnapshot)
  const getSupplements = useSupplementStore((s) => s.getSupplements)
  const getSessionWithSupplements = useSupplementStore((s) => s.getSessionWithSupplements)
  const [refreshKey, setRefreshKey] = useState(0)

  const rawSession = sessionId ? getSession(sessionId) : undefined
  const currentSession = useMemo(() => {
    if (!sessionId) return undefined
    return getSessionWithSupplements(sessionId) ?? rawSession
  }, [sessionId, rawSession, getSessionWithSupplements])

  useEffect(() => {
    loadSessions()
    loadSupplements()
  }, [loadSessions, loadSupplements])

  useEffect(() => {
    if (rawSession) {
      saveBaseline(rawSession.id, rawSession)
    }
  }, [rawSession?.id, rawSession, saveBaseline])

  if (!currentSession || !rawSession) {
    return (
      <div className="pt-20 bg-cafe-cream min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-cafe-brown/60 text-lg mb-4">未找到游戏记录</p>
          <Link to="/" className="btn-primary">返回首页</Link>
        </div>
      </div>
    )
  }

  const level = LEVELS.find((l) => l.id === currentSession.levelId)
  const baseline = getBaselineSnapshot(currentSession.id)
  const supplements = getSupplements(currentSession.id)

  const statusLabel = currentSession.status === 'completed' ? '通关' : '失败'
  const statusColor = currentSession.status === 'completed' ? 'text-safe-green' : 'text-risk-red'

  return (
    <div className="pt-20 bg-cafe-cream min-h-screen">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-6 h-6 text-cafe-brown" />
            <h1 className="font-serif text-3xl text-cafe-brown">补录工作台</h1>
          </div>
          <p className="text-sm text-cafe-brown/50">活动策划阿蓝专用 · 补录后差异自动同步至所有页面</p>
        </div>

        <div className="card-cafe mb-6">
          <div className="flex flex-wrap items-center gap-4 text-sm text-cafe-brown/70">
            <span>关卡: {level?.name ?? currentSession.levelId}</span>
            <span>·</span>
            <span>得分: {currentSession.currentScore.toFixed(1)}
              {baseline && currentSession.currentScore !== baseline.currentScore && (
                <span className="ml-2 text-risk-yellow text-xs">
                  (基线: {baseline.currentScore.toFixed(1)})
                </span>
              )}
            </span>
            <span>·</span>
            <span>风险: {(currentSession.currentRisk * 100).toFixed(1)}%
              {baseline && currentSession.currentRisk !== baseline.currentRisk && (
                <span className="ml-2 text-risk-yellow text-xs">
                  (基线: {(baseline.currentRisk * 100).toFixed(1)}%)
                </span>
              )}
            </span>
            <span>·</span>
            <span className={statusColor}>{statusLabel}</span>
            {supplements.length > 0 && (
              <>
                <span>·</span>
                <span className="text-data-blue text-xs">
                  已补录 {supplements.length} 条
                </span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SupplementForm
            sessionId={currentSession.id}
            currentHoldings={rawSession.holdings}
            onAdded={() => setRefreshKey((k) => k + 1)}
          />
          <DiffViewer
            key={refreshKey}
            baseline={baseline ?? null}
            currentSession={currentSession}
            supplements={supplements}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="btn-secondary"
            onClick={() => navigate(`/summary/${currentSession.id}`)}
          >
            返回汇总（已同步补录）
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate(`/conflict/${currentSession.id}`)}
          >
            查看冲突仲裁
          </button>
        </div>
      </div>
    </div>
  )
}
