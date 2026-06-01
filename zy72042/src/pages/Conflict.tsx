import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useConflictStore } from '@/stores/conflictStore'
import { useHistoryStore } from '@/stores/historyStore'
import { detectConflicts } from '@/engine/conflictDetector'
import { NOTEBOOK_SAMPLES } from '@/data/notebookSamples'
import EvidencePanel from '@/components/conflict/EvidencePanel'
import ResolutionPicker from '@/components/conflict/ResolutionPicker'

export default function Conflict() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const getSession = useHistoryStore((s) => s.getSession)
  const loadSessions = useHistoryStore((s) => s.loadSessions)
  const addConflict = useConflictStore((s) => s.addConflict)
  const resolveConflict = useConflictStore((s) => s.resolveConflict)
  const getConflictsForSession = useConflictStore((s) => s.getConflictsForSession)

  const session = sessionId ? getSession(sessionId) : undefined

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (!session) return
    const existing = getConflictsForSession(session.id)
    if (existing.length > 0) return
    const detected = detectConflicts(session, NOTEBOOK_SAMPLES)
    for (const conflict of detected) {
      addConflict(conflict)
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

  const conflicts = getConflictsForSession(session.id)

  return (
    <div className="pt-20 bg-cafe-cream min-h-screen">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-6 h-6 text-risk-yellow" />
            <h1 className="font-serif text-3xl text-cafe-brown">冲突仲裁</h1>
          </div>
          <p className="text-sm text-cafe-brown/50">
            当教师错题本与导入数据冲突时，请根据双方证据做出判断
          </p>
        </div>

        {conflicts.length === 0 ? (
          <div className="card-cafe flex items-center gap-3 justify-center py-8">
            <CheckCircle className="w-6 h-6 text-safe-green" />
            <span className="text-safe-green font-medium">未发现数据冲突</span>
          </div>
        ) : (
          conflicts.map((conflict) => (
            <div key={conflict.id} className="space-y-3">
              <EvidencePanel conflict={conflict} />
              <ResolutionPicker
                conflict={conflict}
                onResolve={(resolution) => resolveConflict(conflict.id, resolution)}
              />
            </div>
          ))
        )}

        <button
          className="btn-secondary"
          onClick={() => navigate(`/summary/${session.id}`)}
        >
          返回汇总
        </button>
      </div>
    </div>
  )
}
