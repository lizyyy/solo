import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Eye, MessageSquare, Send, Clock, Shield, Copy, FileDown, User, ArrowRight } from 'lucide-react'
import { useStore, type BoundarySample } from '@/store'
import ConfirmModal from '@/components/ConfirmModal'

const typeLabels: Record<string, string> = {
  negative_as_missing: '负数标缺失',
  value_out_of_range: '值超出范围',
  duplicate_detected: '重复检测',
}

const typeColors: Record<string, string> = {
  negative_as_missing: 'bg-rose-500/10 text-rose-400',
  value_out_of_range: 'bg-amber-500/10 text-amber-400',
  duplicate_detected: 'bg-purple-500/10 text-purple-400',
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待处理', color: 'bg-amber-500/10 text-amber-500', icon: AlertTriangle },
  confirmed: { label: '已确认', color: 'bg-emerald-500/10 text-emerald-500', icon: CheckCircle },
  ignored: { label: '已忽略', color: 'bg-slate-600/30 text-slate-400', icon: Eye },
}

const oldStatusDisplay: Record<string, { label: string; color: string }> = {
  missing: { label: '缺失', color: 'text-rose-500' },
  normal: { label: '正常', color: 'text-slate-400' },
  anomaly: { label: '异常', color: 'text-amber-500' },
}

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

function BoundaryCard({ sample, userRole }: { sample: BoundarySample; userRole: string }) {
  const { updateBoundaryStatus, addReviewComment } = useStore()
  const navigate = useNavigate()
  const [comment, setComment] = useState('')
  const [processReason, setProcessReason] = useState(sample.processReason ?? '')
  const [decisionDetail, setDecisionDetail] = useState(sample.decisionDetail ?? '')
  const [correctedValue, setCorrectedValue] = useState<string>(sample.correctedValue?.toString() ?? '')
  const [validateError, setValidateError] = useState('')
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; status: 'confirmed' | 'ignored' }>({ open: false, status: 'confirmed' })
  const [copied, setCopied] = useState(false)
  const isPending = sample.status === 'pending'
  const isStudent = userRole === '学生助教'
  const isLeader = userRole === '教研负责人'
  const statusCfg = statusConfig[sample.status]
  const oldStatusCfg = oldStatusDisplay[sample.oldTableStatus ?? 'normal'] ?? oldStatusDisplay.normal

  const handleCopyId = () => {
    copyToClipboard(sample.traceableId ?? sample.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleStatusClick = (status: 'confirmed' | 'ignored') => {
    if (userRole !== '教研负责人') return
    if (!processReason.trim() || !decisionDetail.trim()) {
      setValidateError('请先填写处理原因和确认说明')
      return
    }
    setValidateError('')
    setConfirmModal({ open: true, status })
  }

  const handleConfirm = async () => {
    try {
      await updateBoundaryStatus(sample.id, confirmModal.status, {
        processReason,
        decisionDetail,
        correctedValue: correctedValue ? Number(correctedValue) : undefined,
      })
      setConfirmModal({ open: false, status: 'confirmed' })
    } catch {}
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    await addReviewComment(sample.id, comment.trim())
    setComment('')
  }

  const effectiveCorrected = correctedValue ? Number(correctedValue) : sample.originalValue

  return (
    <>
      <div className={`bg-slate-800/50 backdrop-blur rounded-xl border ${isPending ? 'border-amber-500/30 animate-pulse-amber' : 'border-slate-700/50'} p-5 space-y-4`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 border border-slate-600 rounded text-xs font-mono text-slate-300 hover:border-amber-500/50 hover:text-amber-500 transition-colors"
              title="点击复制可追溯ID"
            >
              <Copy size={10} />
              {(sample.traceableId ?? sample.id).slice(0, 8)}
              {copied && <span className="text-emerald-400 ml-1">已复制</span>}
            </button>
            {sample.listId && (
              <button
                onClick={() => navigate(`/sampling/${sample.listId}`)}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 border border-slate-600 rounded text-xs text-slate-300 hover:border-amber-500/50 hover:text-amber-500 transition-colors"
              >
                📄 {sample.listName ?? '抽样名单'}
              </button>
            )}
            {sample.batchId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/30 border border-slate-600/50 rounded text-xs font-mono text-slate-400">
                #{sample.batchId.slice(0, 8)}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[sample.type] || 'bg-slate-600/30 text-slate-400'}`}>
              {typeLabels[sample.type] || sample.type}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color} flex items-center gap-1`}>
              <statusCfg.icon size={12} />
              {statusCfg.label}
            </span>
          </div>
          {isLeader && isPending && (
            <div className="flex gap-1">
              <button onClick={() => handleStatusClick('confirmed')} className="px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors">确认</button>
              <button onClick={() => handleStatusClick('ignored')} className="px-2.5 py-1 text-xs bg-slate-600/30 text-slate-400 rounded hover:bg-slate-600/50 transition-colors">忽略</button>
            </div>
          )}
        </div>

        <div className="bg-slate-700/30 rounded-lg p-3 space-y-2">
          <p className="text-xs text-slate-500 font-medium">A. 原始信息区</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-500">【原始值】 </span>
              <span className={`font-mono ${(sample.originalValue ?? 0) < 0 ? 'text-rose-500' : 'text-slate-200'}`}>
                {sample.originalValue?.toFixed(2) ?? '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">旧表状态：</span>
              <span className={oldStatusCfg.color}>{oldStatusCfg.label}</span>
            </div>
            <div className="md:col-span-2">
              <span className="text-slate-500">检测原因：</span>
              <span className="text-slate-300">{sample.description}</span>
            </div>
            {sample.remark && (
              <div className="md:col-span-2">
                <span className="text-slate-500">原始备注：</span>
                <span className="text-slate-400">{sample.remark}</span>
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-lg p-3 space-y-2 ${isPending ? 'bg-blue-500/5 border border-blue-500/20' : 'bg-slate-700/30 border border-slate-700/50'}`}>
          <p className={`text-xs font-medium ${isPending ? 'text-blue-400' : 'text-slate-500'}`}>B. 人工判断区</p>
          <div className="space-y-2 text-sm">
            <div>
              <label className="text-slate-500 block text-xs mb-1">【处理原因】{isPending && <span className="text-rose-400">*</span>}</label>
              {isPending ? (
                <input
                  type="text"
                  value={processReason}
                  onChange={e => { setProcessReason(e.target.value); setValidateError('') }}
                  placeholder="如：业务逻辑确认为负数，需修正为0"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                />
              ) : (
                <p className="text-slate-300 bg-slate-800/30 rounded px-3 py-1.5">{sample.processReason ?? '-'}</p>
              )}
            </div>
            <div>
              <label className="text-slate-500 block text-xs mb-1">【确认/驳回说明】{isPending && <span className="text-rose-400">*</span>}</label>
              {isPending ? (
                <textarea
                  value={decisionDetail}
                  onChange={e => { setDecisionDetail(e.target.value); setValidateError('') }}
                  placeholder="如：经核对原始数据表，该条记录确为系统录入错误，实际值应为0"
                  rows={2}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 resize-none"
                />
              ) : (
                <p className="text-slate-300 bg-slate-800/30 rounded px-3 py-1.5 whitespace-pre-wrap">{sample.decisionDetail ?? '-'}</p>
              )}
            </div>
            <div>
              <label className="text-slate-500 block text-xs mb-1">【人工修正值】<span className="text-slate-600">（不填则使用原始值）</span></label>
              {isPending ? (
                <input
                  type="number"
                  value={correctedValue}
                  onChange={e => setCorrectedValue(e.target.value)}
                  placeholder={`默认 ${sample.originalValue?.toFixed(2) ?? 0}`}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 font-mono"
                />
              ) : (
                <p className="text-slate-300 bg-slate-800/30 rounded px-3 py-1.5 font-mono">
                  {sample.correctedValue?.toFixed(2) ?? sample.originalValue?.toFixed(2) ?? '-'}
                </p>
              )}
            </div>
            {validateError && (
              <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">
                ⚠ {validateError}
              </p>
            )}
          </div>
        </div>

        <div className="bg-slate-700/20 rounded-lg p-3 space-y-3">
          <p className="text-xs text-slate-500 font-medium">C. 复核工作流区</p>
          {sample.reviewComments.length > 0 && (
            <div className="space-y-2">
              {sample.reviewComments.map(c => (
                <div key={c.id} className="bg-slate-800/30 rounded-lg p-2 text-sm border-l-2 border-amber-500/30">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <User size={12} className="text-slate-500" />
                    <span className="text-slate-300 text-xs">{c.author}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      c.authorRole === '教研负责人' ? 'bg-emerald-500/10 text-emerald-400' :
                      c.authorRole === '学生助教' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-slate-600/30 text-slate-400'
                    }`}>{c.authorRole}</span>
                    <span className="text-slate-600 text-xs ml-auto">{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="text-slate-400 text-xs pl-5">{c.content}</p>
                </div>
              ))}
            </div>
          )}
          <div className={`rounded-lg p-2 ${isStudent && isPending ? 'bg-blue-500/5 border border-blue-500/20' : ''}`}>
            {isStudent && isPending && (
              <p className="text-xs text-blue-400 mb-2 flex items-center gap-1">
                <ArrowRight size={12} />
                下一步：请教研负责人最终确认
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={isStudent ? '学生助教复核意见...' : '添加复核意见...'}
                className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                onKeyDown={e => { if (e.key === 'Enter') handleAddComment() }}
              />
              <button onClick={handleAddComment} className="px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors">
                <Send size={14} />
              </button>
            </div>
          </div>
          <div className={`rounded-lg p-2 ${isLeader && isPending ? 'bg-emerald-500/5 border border-emerald-500/20' : ''}`}>
            <p className="text-xs text-slate-500">
              {isLeader && isPending ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Shield size={12} />
                  下一步找谁：教研负责人（当前为您 → 请使用上方确认/驳回按钮）
                </span>
              ) : isPending ? (
                <span>
                  下一步找谁：教研负责人 吴老师
                </span>
              ) : (
                <span>
                  处理已完成，无需后续操作
                </span>
              )}
            </p>
          </div>
        </div>

        {!isPending && (
          <div className="bg-emerald-500/5 rounded-lg p-3 space-y-2 border border-emerald-500/20">
            <p className="text-xs text-emerald-500 font-medium">D. 处理结果区</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
                {sample.confirmedBy && (
                  <>
                    <Shield size={12} className="text-slate-500" />
                    <span className="text-slate-400 text-xs">{sample.confirmedBy}</span>
                  </>
                )}
                {sample.confirmedAt && (
                  <>
                    <Clock size={12} className="text-slate-500" />
                    <span className="text-slate-500 text-xs">{new Date(sample.confirmedAt).toLocaleString('zh-CN')}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="line-through text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-mono text-xs">
                  {sample.originalValue?.toFixed(2)}
                </span>
                <ArrowRight size={12} className="text-slate-500" />
                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono text-xs">
                  {(sample.correctedValue ?? sample.originalValue)?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.open}
        title={`确认${confirmModal.status === 'confirmed' ? '确认' : '忽略'}此边界样本`}
        description={`您即将将此边界样本标记为"${confirmModal.status === 'confirmed' ? '已确认' : '已忽略'}"，以下为处理预览：`}
        preview={{
          from: `${sample.originalValue?.toFixed(2) ?? '-'}（待处理）`,
          to: `${effectiveCorrected?.toFixed(2) ?? '-'}（${confirmModal.status === 'confirmed' ? '已确认' : '已忽略'}）`,
        }}
        warn={`将写入：处理原因、确认说明、人工修正值（如有）、确认人=${userRole}`}
        confirmText={confirmModal.status === 'confirmed' ? '确认' : '确认忽略'}
        cancelText="取消"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmModal({ open: false, status: 'confirmed' })}
      />
    </>
  )
}

const filterTabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'confirmed', label: '已确认' },
  { key: 'ignored', label: '已忽略' },
]

export default function Boundary() {
  const { boundarySamples, userRole, fetchBoundarySamples, exportBoundary } = useStore()
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchBoundarySamples()
  }, [])

  const handleFilter = (key: string) => {
    setFilter(key)
    fetchBoundarySamples(key === 'all' ? undefined : key)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>边界样本报告</h2>
        <button
          onClick={exportBoundary}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700 hover:text-amber-500 transition-colors"
        >
          <FileDown size={16} />
          导出边界样本报告
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-48 shrink-0 space-y-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleFilter(tab.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${filter === tab.key ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4">
          {boundarySamples.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center text-slate-500">
              暂无边界样本
            </div>
          ) : (
            boundarySamples.map(sample => (
              <BoundaryCard key={sample.id} sample={sample} userRole={userRole} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
