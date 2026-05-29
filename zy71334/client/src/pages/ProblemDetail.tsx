import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, History, GitCompare, Download, AlertTriangle, Sliders, User, Clock, CheckCircle } from 'lucide-react'
import { problemApi } from '../services/api'
import { ProblemWithDetails, CreateVersionRequest, sectionOptions } from '../types'
import { formatDateTime, timeAgo, getStatusBgClass } from '../utils/format'
import ProblemTimeline from '../components/ProblemTimeline'
import VersionDiffViewer from '../components/VersionDiffViewer'
import SignaturePanel from '../components/SignaturePanel'
import AnomalyCard from '../components/AnomalyCard'

export default function ProblemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [problem, setProblem] = useState<ProblemWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [newVersion, setNewVersion] = useState<CreateVersionRequest>({
    tuningAction: '',
    operatorName: '李音响师',
    changeReason: '',
  })

  useEffect(() => {
    if (id) loadProblem()
  }, [id])

  const loadProblem = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await problemApi.getProblemById(id)
      setProblem(data)
    } catch (error) {
      console.error('Failed to load problem:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVersion = async () => {
    if (!id || !newVersion.tuningAction) return

    try {
      await problemApi.createVersion(id, newVersion)
      setShowVersionModal(false)
      setNewVersion({
        tuningAction: '',
        operatorName: '李音响师',
        changeReason: '',
      })
      loadProblem()
    } catch (error) {
      console.error('Failed to create version:', error)
    }
  }

  const handleConfirmed = () => {
    loadProblem()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stage-blue rounded w-48" />
          <div className="h-32 bg-stage-dark rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-stage-dark rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">问题不存在</p>
        <Link to="/" className="text-accent-amber text-sm mt-2 inline-block">返回工作台</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-stage-blue transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-bold text-white">
                {problem.musicianName} - 通道 {problem.channel}
              </h2>
              <span className={`px-2 py-1 rounded text-xs border ${getStatusBgClass(problem.status)}`}>
                {problem.status === 'pending' && '待处理'}
                {problem.status === 'in_progress' && '处理中'}
                {problem.status === 'resolved' && '已解决'}
                {problem.status === 'confirmed' && '已确认'}
              </span>
              {problem.anomalies.length > 0 && (
                <span className="px-2 py-1 rounded text-xs bg-accent-red/10 text-accent-red border border-accent-red/30">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  {problem.anomalies.length} 个异常
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
              <span>{problem.section}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                发现于 {formatDateTime(problem.discoveredAt)}
              </span>
              <span className="flex items-center gap-1">
                <History className="w-3 h-3" />
                V{problem.currentVersion} · {problem.versions.length} 个历史版本
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVersionModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            记录调音动作
          </button>
          <Link
            to={`/problem/${id}/versions`}
            className="btn-secondary flex items-center gap-2"
          >
            <GitCompare className="w-4 h-4" />
            版本历史
          </Link>
          <Link
            to={`/confirm/${id}`}
            className="btn-secondary flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            签收确认
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <span className="label">乐手</span>
            <p className="text-white font-medium">{problem.musicianName}</p>
          </div>
          <div>
            <span className="label">声部</span>
            <p className="text-white font-medium">{problem.section}</p>
          </div>
          <div>
            <span className="label">监听通道</span>
            <p className="text-white font-mono text-xl font-bold text-accent-amber">CH {problem.channel}</p>
          </div>
          <div>
            <span className="label">当前版本</span>
            <p className="text-white font-mono text-xl font-bold">V{problem.currentVersion}</p>
          </div>
          <div className="col-span-4">
            <span className="label">问题描述</span>
            <p className="text-white">{problem.description}</p>
          </div>
        </div>
      </div>

      {problem.anomalies.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent-amber" />
            异常记录 ({problem.anomalies.length})
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {problem.anomalies.map((anomaly) => (
              <AnomalyCard key={anomaly.id} anomaly={anomaly} showLink={false} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div>
            <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-accent-amber" />
              完整追溯链路
            </h3>
            <ProblemTimeline problem={problem} />
          </div>
        </div>

        <div className="space-y-6">
          {problem.versions.length >= 2 && (
            <VersionDiffViewer problemId={problem.id} versions={problem.versions} />
          )}

          <SignaturePanel
            problemId={problem.id}
            confirmation={problem.confirmation}
            currentVersion={problem.currentVersion}
            onConfirmed={handleConfirmed}
          />

          <div className="card">
            <h3 className="font-display text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent-amber" />
              快捷操作
            </h3>
            <div className="space-y-2">
              <Link
                to={`/problem/${problem.id}/history`}
                className="block w-full p-3 rounded-lg bg-stage-darker hover:bg-stage-blue text-sm text-slate-300 transition-colors"
              >
                <History className="w-4 h-4 inline mr-2" />
                查看完整版本历史
              </Link>
              <Link
                to={`/export`}
                className="block w-full p-3 rounded-lg bg-stage-darker hover:bg-stage-blue text-sm text-slate-300 transition-colors"
              >
                <Download className="w-4 h-4 inline mr-2" />
                导出返听报告
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showVersionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg">
            <h3 className="font-display text-lg font-bold text-white mb-4">记录调音动作</h3>
            <p className="text-xs text-slate-400 mb-4">
              创建新版本 V{problem.currentVersion + 1}，旧版本将永久保留
            </p>

            <div className="space-y-4">
              <div>
                <label className="label">操作人</label>
                <input
                  type="text"
                  value={newVersion.operatorName}
                  onChange={(e) => setNewVersion(v => ({ ...v, operatorName: e.target.value }))}
                  className="input"
                />
              </div>

              <div>
                <label className="label">调音动作描述</label>
                <textarea
                  value={newVersion.tuningAction}
                  onChange={(e) => setNewVersion(v => ({ ...v, tuningAction: e.target.value }))}
                  placeholder="如：衰减8kHz频段，降低齿音"
                  className="input resize-none h-24"
                />
              </div>

              <div>
                <label className="label">修改原因（可选）</label>
                <input
                  type="text"
                  value={newVersion.changeReason}
                  onChange={(e) => setNewVersion(v => ({ ...v, changeReason: e.target.value }))}
                  placeholder="如：乐手反馈仍有齿音"
                  className="input"
                />
              </div>

              <div className="bg-stage-darker rounded p-3">
                <p className="text-xs text-slate-400 mb-2">
                  <span className="text-accent-amber">💡 提示</span>：调音参数将自动记录在版本中，可在版本对比中查看差异
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-stage-border">
                <button
                  onClick={() => setShowVersionModal(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateVersion}
                  disabled={!newVersion.tuningAction || !newVersion.operatorName}
                  className="btn-primary"
                >
                  创建新版本
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
