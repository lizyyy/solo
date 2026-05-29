import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, User, Clock, AlertTriangle, Mic, History, FileText } from 'lucide-react'
import { problemApi } from '../services/api'
import { ProblemWithDetails, ConfirmRequest } from '../types'
import { formatDateTime, getStatusBgClass, timeAgo } from '../utils/format'
import SignaturePanel from '../components/SignaturePanel'
import ProblemTimeline from '../components/ProblemTimeline'

export default function Confirmation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [problem, setProblem] = useState<ProblemWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [musicianSignature, setMusicianSignature] = useState('')
  const [engineerSignature, setEngineerSignature] = useState('')
  const [notes, setNotes] = useState('')
  const [signingType, setSigningType] = useState<'musician' | 'engineer' | null>(null)

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

  const handleSign = async (type: 'musician' | 'engineer') => {
    if (!id) return
    const signature = type === 'musician' ? musicianSignature : engineerSignature
    if (!signature.trim()) return

    try {
      const data: ConfirmRequest = {
        type,
        signature: signature.trim(),
        notes: notes || undefined,
      }
      await problemApi.confirm(id, data)
      if (type === 'musician') {
        setMusicianSignature('')
      } else {
        setEngineerSignature('')
      }
      setNotes('')
      setSigningType(null)
      loadProblem()
    } catch (error) {
      console.error('Failed to sign:', error)
    }
  }

  const handleConfirmed = () => {
    loadProblem()
  }

  const isFullyConfirmed = problem?.confirmation?.musicianSigned && problem?.confirmation?.engineerSigned

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stage-blue rounded w-48" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-48 bg-stage-dark rounded" />
            ))}
          </div>
          <div className="h-64 bg-stage-dark rounded" />
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
                签收确认 - {problem.musicianName}
              </h2>
              <span className={`px-2 py-1 rounded text-xs border ${getStatusBgClass(problem.status)}`}>
                {problem.status === 'pending' && '待处理'}
                {problem.status === 'in_progress' && '处理中'}
                {problem.status === 'resolved' && '已解决'}
                {problem.status === 'confirmed' && '已确认'}
              </span>
              {isFullyConfirmed && (
                <span className="px-2 py-1 rounded text-xs bg-accent-green/10 text-accent-green border border-accent-green/30">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  双签完成
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              通道 {problem.channel} · {problem.section} · V{problem.currentVersion}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/problem/${id}/history`}
            className="btn-secondary flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            查看版本
          </Link>
        </div>
      </div>

      {isFullyConfirmed && (
        <div className="card bg-accent-green/5 border-accent-green/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-green/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-accent-green" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-accent-green">签收确认已完成</h3>
              <p className="text-sm text-slate-400">乐手和工程师均已确认问题解决，此问题单已正式关闭</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Mic className="w-4 h-4 text-accent-amber" />
              问题概览
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="label">乐手</span>
                  <p className="text-white font-medium">{problem.musicianName}</p>
                </div>
                <div>
                  <span className="label">声部</span>
                  <p className="text-white">{problem.section}</p>
                </div>
                <div>
                  <span className="label">监听通道</span>
                  <p className="text-white font-mono text-lg font-bold text-accent-amber">CH {problem.channel}</p>
                </div>
                <div>
                  <span className="label">当前版本</span>
                  <p className="text-white font-mono text-lg font-bold">V{problem.currentVersion}</p>
                </div>
              </div>
              <div>
                <span className="label">问题描述</span>
                <p className="text-white text-sm">{problem.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="label">发现时间</span>
                  <p className="text-slate-300">{formatDateTime(problem.discoveredAt)}</p>
                </div>
                <div>
                  <span className="label">处理时长</span>
                  <p className="text-slate-300">{timeAgo(problem.discoveredAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {problem.anomalies.length > 0 && (
            <div className="card">
              <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-accent-amber" />
                异常记录 ({problem.anomalies.length})
              </h3>
              <div className="space-y-3">
                {problem.anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={`p-3 rounded-lg border ${
                      anomaly.type === 'channel_invalid'
                        ? 'bg-accent-red/5 border-accent-red/30'
                        : anomaly.type === 'duplicate'
                        ? 'bg-accent-amber/5 border-accent-amber/30'
                        : 'bg-accent-yellow/5 border-accent-yellow/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium ${
                        anomaly.type === 'channel_invalid' ? 'text-accent-red' :
                        anomaly.type === 'duplicate' ? 'text-accent-amber' : 'text-accent-yellow'
                      }`}>
                        {anomaly.type === 'channel_invalid' && '通道错误'}
                        {anomaly.type === 'duplicate' && '重复问题'}
                        {anomaly.type === 'overwrite' && '覆盖风险'}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(anomaly.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-300 mb-1"><span className="text-slate-500">原因：</span>{anomaly.reason}</p>
                    <p className="text-sm text-slate-300 mb-1"><span className="text-slate-500">影响：</span>{anomaly.impact}</p>
                    <p className="text-sm text-accent-green"><span className="text-slate-500">处理：</span>{anomaly.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-accent-amber" />
              处理过程
            </h3>
            <ProblemTimeline problem={problem} compact />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent-amber" />
              双签确认
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              问题解决后需要乐手和工程师双方签字确认，确认后问题单正式关闭
            </p>

            <div className="space-y-6">
              <div className={`p-4 rounded-lg border ${
                problem.confirmation?.musicianSigned
                  ? 'bg-accent-green/5 border-accent-green/30'
                  : 'bg-stage-darker border-stage-border'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      problem.confirmation?.musicianSigned
                        ? 'bg-accent-green/20'
                        : 'bg-stage-blue'
                    }`}>
                      <User className={`w-4 h-4 ${
                        problem.confirmation?.musicianSigned
                          ? 'text-accent-green'
                          : 'text-slate-400'
                      }`} />
                    </div>
                    <div>
                      <span className="text-white font-medium text-sm">乐手签收</span>
                      <p className="text-xs text-slate-500">{problem.musicianName}</p>
                    </div>
                  </div>
                  {problem.confirmation?.musicianSigned ? (
                    <span className="text-xs px-2 py-1 rounded bg-accent-green/10 text-accent-green border border-accent-green/30">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      已签收
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-slate-500/10 text-slate-400 border border-slate-500/30">
                      待签收
                    </span>
                  )}
                </div>

                {problem.confirmation?.musicianSigned ? (
                  <div className="space-y-2">
                    <div>
                      <span className="label">签收人</span>
                      <p className="text-white text-sm">{problem.confirmation.musicianSignature}</p>
                    </div>
                    <div>
                      <span className="label">签收时间</span>
                      <p className="text-slate-300 text-sm">
                        {problem.confirmation.musicianSignedAt && formatDateTime(problem.confirmation.musicianSignedAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {signingType === 'musician' ? (
                      <>
                        <div>
                          <label className="label">乐手签名（姓名）</label>
                          <input
                            type="text"
                            value={musicianSignature}
                            onChange={(e) => setMusicianSignature(e.target.value)}
                            placeholder="请输入乐手姓名"
                            className="input"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSign('musician')}
                            disabled={!musicianSignature.trim()}
                            className="btn-primary flex-1"
                          >
                            确认签收
                          </button>
                          <button
                            onClick={() => { setSigningType(null); setMusicianSignature('') }}
                            className="btn-secondary"
                          >
                            取消
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setSigningType('musician')}
                        disabled={problem.status !== 'resolved' && problem.status !== 'in_progress'}
                        className="btn-primary w-full"
                      >
                        乐手签收
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-lg border ${
                problem.confirmation?.engineerSigned
                  ? 'bg-accent-green/5 border-accent-green/30'
                  : 'bg-stage-darker border-stage-border'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      problem.confirmation?.engineerSigned
                        ? 'bg-accent-green/20'
                        : 'bg-stage-blue'
                    }`}>
                      <User className={`w-4 h-4 ${
                        problem.confirmation?.engineerSigned
                          ? 'text-accent-green'
                          : 'text-slate-400'
                      }`} />
                    </div>
                    <div>
                      <span className="text-white font-medium text-sm">工程师签收</span>
                      <p className="text-xs text-slate-500">音响师</p>
                    </div>
                  </div>
                  {problem.confirmation?.engineerSigned ? (
                    <span className="text-xs px-2 py-1 rounded bg-accent-green/10 text-accent-green border border-accent-green/30">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      已签收
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-slate-500/10 text-slate-400 border border-slate-500/30">
                      待签收
                    </span>
                  )}
                </div>

                {problem.confirmation?.engineerSigned ? (
                  <div className="space-y-2">
                    <div>
                      <span className="label">签收人</span>
                      <p className="text-white text-sm">{problem.confirmation.engineerSignature}</p>
                    </div>
                    <div>
                      <span className="label">签收时间</span>
                      <p className="text-slate-300 text-sm">
                        {problem.confirmation.engineerSignedAt && formatDateTime(problem.confirmation.engineerSignedAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {signingType === 'engineer' ? (
                      <>
                        <div>
                          <label className="label">工程师签名（姓名）</label>
                          <input
                            type="text"
                            value={engineerSignature}
                            onChange={(e) => setEngineerSignature(e.target.value)}
                            placeholder="请输入工程师姓名"
                            className="input"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSign('engineer')}
                            disabled={!engineerSignature.trim()}
                            className="btn-primary flex-1"
                          >
                            确认签收
                          </button>
                          <button
                            onClick={() => { setSigningType(null); setEngineerSignature('') }}
                            className="btn-secondary"
                          >
                            取消
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setSigningType('engineer')}
                        disabled={problem.status !== 'resolved' && problem.status !== 'in_progress'}
                        className="btn-primary w-full"
                      >
                        工程师签收
                      </button>
                    )}
                  </div>
                )}
              </div>

              {(signingType === 'musician' || signingType === 'engineer') && (
                <div>
                  <label className="label">备注（可选）</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="添加签收备注，如：已满意，问题已解决"
                    className="input resize-none h-20"
                  />
                </div>
              )}

              {problem.confirmation?.notes && (
                <div className="bg-stage-darker rounded-lg p-3">
                  <span className="label">签收备注</span>
                  <p className="text-sm text-slate-300 mt-1">{problem.confirmation.notes}</p>
                </div>
              )}
            </div>
          </div>

          <SignaturePanel
            problemId={problem.id}
            confirmation={problem.confirmation}
            currentVersion={problem.currentVersion}
            onConfirmed={handleConfirmed}
          />

          <div className="card">
            <h3 className="font-display text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent-amber" />
              验收路径
            </h3>
            <div className="space-y-2">
              <Link
                to="/"
                className="block p-3 rounded-lg bg-stage-darker hover:bg-stage-blue text-sm text-slate-300 transition-colors"
              >
                1. 通道状态 → 返回工作台查看32通道总览
              </Link>
              <Link
                to="/"
                className="block p-3 rounded-lg bg-stage-darker hover:bg-stage-blue text-sm text-slate-300 transition-colors"
              >
                2. 问题去重 → 工作台查看异常检测标记的重复问题
              </Link>
              <Link
                to={`/problem/${id}/history`}
                className="block p-3 rounded-lg bg-stage-darker hover:bg-stage-blue text-sm text-slate-300 transition-colors"
              >
                3. 版本留痕 → 查看完整版本历史和对比
              </Link>
              <div className="block p-3 rounded-lg bg-accent-amber/5 border border-accent-amber/30 text-sm text-accent-amber">
                4. 签收确认 → 当前页面，完成双签确认
              </div>
              <Link
                to="/export"
                className="block p-3 rounded-lg bg-stage-darker hover:bg-stage-blue text-sm text-slate-300 transition-colors"
              >
                5. 报告导出 → 生成并导出PDF报告
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
