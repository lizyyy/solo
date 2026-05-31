import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDeviationStore } from '@/store/useDeviationStore'
import {
  DEVIATION_TYPE_LABELS,
  RECORD_SOURCE_LABELS,
  RECORD_STATUS_LABELS,
  FIELD_LABELS,
  ABNORMAL_TYPES,
} from '@/types'
import type { RecordStatus } from '@/types'
import { StatusBadge } from '@/components/StatusBadge'
import Modal from '@/components/Modal'
import {
  ArrowLeft,
  Clock,
  User,
  GitBranch,
  FileText,
  ShieldCheck,
  Edit3,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react'

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const store = useDeviationStore()

  const record = store.getRecordById(id || '')
  const transitions = store.getTransitionsForRecord(id || '')
  const corrections = store.getCorrectionsForRecord(id || '')
  const reviews = store.getReviewsForRecord(id || '')

  const [showCorrect, setShowCorrect] = useState(false)
  const [correctField, setCorrectField] = useState('')
  const [correctNewValue, setCorrectNewValue] = useState('')
  const [correctReason, setCorrectReason] = useState('')

  const [showReview, setShowReview] = useState(false)
  const [reviewResult, setReviewResult] = useState<'pass' | 'questioned'>('pass')
  const [reviewReason, setReviewReason] = useState('')

  const [showTransition, setShowTransition] = useState(false)
  const [transitionTarget, setTransitionTarget] = useState<RecordStatus>('confirmed')
  const [transitionReason, setTransitionReason] = useState('')

  if (!record) {
    return (
      <div className="pl-16 lg:pl-56 min-h-screen flex items-center justify-center">
        <div className="text-slate-400">记录不存在</div>
      </div>
    )
  }

  const isAbnormal = (ABNORMAL_TYPES as string[]).includes(record.deviationType)
  const hasPassReview = reviews.some((r) => r.result === 'pass')

  const handleCorrect = () => {
    if (!correctField || !correctNewValue || !correctReason) return
    const oldValue = String((record as unknown as Record<string, unknown>)[correctField] ?? '')
    store.correctRecord(record.id, correctField, oldValue, correctNewValue, correctReason)
    setShowCorrect(false)
    setCorrectField('')
    setCorrectNewValue('')
    setCorrectReason('')
  }

  const handleReview = () => {
    if (!reviewReason) return
    store.addReview(record.id, reviewResult, reviewReason)
    setShowReview(false)
    setReviewReason('')
  }

  const handleTransition = () => {
    if (!transitionReason) return
    if (!store.canTransitionTo(record.id, transitionTarget)) return
    store.transitionStatus(record.id, transitionTarget, transitionReason)
    setShowTransition(false)
    setTransitionReason('')
  }

  const infoFields = [
    { key: 'code', label: '记录编号' },
    { key: 'deviationType', label: '偏差类型', render: () => DEVIATION_TYPE_LABELS[record.deviationType] },
    { key: 'source', label: '来源', render: () => RECORD_SOURCE_LABELS[record.source] },
    { key: 'equipmentCode', label: '设备编号' },
    { key: 'discoveredAt', label: '发现时间', render: () => record.discoveredAt.replace('T', ' ').slice(0, 16) },
    { key: 'createdBy', label: '创建人' },
  ]

  return (
    <div className="pl-16 lg:pl-56 min-h-screen">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-slate-hover text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-white font-mono">{record.code}</h1>
              <StatusBadge status={record.status} />
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {DEVIATION_TYPE_LABELS[record.deviationType]} · {RECORD_SOURCE_LABELS[record.source]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCorrect(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-iron-lighter hover:bg-iron-light text-slate-200 rounded-md text-sm transition-colors"
            >
              <Edit3 size={14} />
              修正
            </button>
            {isAbnormal && (
              <button
                onClick={() => setShowReview(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-md text-sm transition-colors"
              >
                <ShieldCheck size={14} />
                复核
              </button>
            )}
            {record.status !== 'closed' && (
              <button
                onClick={() => {
                  if (isAbnormal && !hasPassReview && record.status === 'pending_confirmation') {
                    setTransitionTarget('confirmed')
                  } else if (record.status === 'pending_processing') {
                    setTransitionTarget('confirmed')
                  } else if (record.status === 'confirmed') {
                    setTransitionTarget('closed')
                  } else {
                    setTransitionTarget('confirmed')
                  }
                  setShowTransition(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-signal hover:bg-signal-dim text-white rounded-md text-sm transition-colors"
              >
                <CheckCircle2 size={14} />
                状态变更
              </button>
            )}
          </div>
        </div>

        {isAbnormal && !hasPassReview && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <AlertTriangle size={18} className="text-orange-400 shrink-0" />
            <div>
              <p className="text-sm text-orange-300 font-medium">
                此记录属于异常类型，必须经过复核流程后才能确认
              </p>
              <p className="text-xs text-orange-300/70 mt-0.5">
                请先完成复核（复核结果为"通过"），再进行状态变更
              </p>
            </div>
          </div>
        )}

        <div className="bg-slate-card rounded-lg border border-iron-lighter p-6 mb-6">
          <h2 className="text-base font-medium text-white mb-4 flex items-center gap-2">
            <FileText size={16} className="text-signal" />
            基本信息
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {infoFields.map((f) => (
              <div key={f.key}>
                <div className="text-xs text-slate-400 mb-1">{f.label}</div>
                <div className="text-sm text-white">
                  {f.render ? f.render() : String((record as unknown as Record<string, unknown>)[f.key] ?? '')}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="text-xs text-slate-400 mb-1">偏差描述</div>
            <div className="text-sm text-slate-200 leading-relaxed">{record.description}</div>
          </div>
        </div>

        <div className="bg-slate-card rounded-lg border border-iron-lighter p-6 mb-6">
          <h2 className="text-base font-medium text-white mb-4 flex items-center gap-2">
            <GitBranch size={16} className="text-signal" />
            状态流转
          </h2>
          <div className="space-y-0">
            {transitions.map((t, i) => (
              <div key={t.id} className="flex gap-4 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border-2 ${i === transitions.length - 1 ? 'bg-signal border-signal' : 'bg-iron-lighter border-iron-lighter'}`} />
                  {i < transitions.length - 1 && <div className="w-0.5 flex-1 bg-iron-lighter mt-1" />}
                </div>
                <div className="flex-1 -mt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {t.fromStatus ? (
                      <>
                        <StatusBadge status={t.fromStatus} />
                        <span className="text-slate-500">→</span>
                        <StatusBadge status={t.toStatus} />
                      </>
                    ) : (
                      <StatusBadge status={t.toStatus} />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><User size={12} />{t.operator}</span>
                    <span className="flex items-center gap-1"><Clock size={12} />{t.operatedAt.replace('T', ' ').slice(0, 16)}</span>
                  </div>
                  {t.reason && (
                    <div className="text-xs text-slate-300 mt-1 bg-slate-bg rounded px-2 py-1 inline-block">
                      {t.reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-card rounded-lg border border-iron-lighter p-6 mb-6">
          <h2 className="text-base font-medium text-white mb-4 flex items-center gap-2">
            <Edit3 size={16} className="text-signal" />
            修正历史
          </h2>
          {corrections.length === 0 ? (
            <p className="text-sm text-slate-500">暂无修正记录</p>
          ) : (
            <div className="space-y-3">
              {corrections.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border ${c.isRevoked ? 'bg-slate-bg/50 border-iron-lighter/50 opacity-60' : 'bg-slate-bg border-iron-lighter'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400">{FIELD_LABELS[c.field] || c.field}</span>
                      <span className="text-slate-500">:</span>
                      <span className="line-through text-red-400/70 text-xs">{c.oldValue}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-emerald-400">{c.newValue}</span>
                    </div>
                    {!c.isRevoked && (
                      <button
                        onClick={() => store.revokeCorrection(c.id)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-signal transition-colors"
                      >
                        <RotateCcw size={12} />
                        撤回
                      </button>
                    )}
                    {c.isRevoked && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <XCircle size={12} />
                        已撤回
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>{c.operator}</span>
                    <span>{c.correctedAt.replace('T', ' ').slice(0, 16)}</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">原因: {c.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAbnormal && (
          <div className="bg-slate-card rounded-lg border-2 border-orange-500/40 p-6">
            <h2 className="text-base font-medium text-white mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-orange-400" />
              复核区
            </h2>
            {reviews.length === 0 ? (
              <div className="text-sm text-slate-400 mb-4">尚无复核记录</div>
            ) : (
              <div className="space-y-3 mb-4">
                {reviews.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-bg rounded-lg border border-iron-lighter">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.result === 'pass'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                      }`}>
                        {r.result === 'pass' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {r.result === 'pass' ? '通过' : '存疑'}
                      </span>
                      <span className="text-slate-300">{r.reviewer}</span>
                      <span className="text-xs text-slate-400">{r.reviewedAt.replace('T', ' ').slice(0, 16)}</span>
                    </div>
                    <div className="text-sm text-slate-300 mt-2">复核原因: {r.reason}</div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowReview(true)}
              className="px-4 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-md text-sm transition-colors"
            >
              添加复核
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={showCorrect} onClose={() => setShowCorrect(false)} title="修正记录">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">修改字段</label>
            <select
              value={correctField}
              onChange={(e) => setCorrectField(e.target.value)}
              className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal"
            >
              <option value="">选择字段</option>
              {Object.entries(FIELD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1 block">新值</label>
            <input
              value={correctNewValue}
              onChange={(e) => setCorrectNewValue(e.target.value)}
              className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1 block">修正原因（必填）</label>
            <textarea
              value={correctReason}
              onChange={(e) => setCorrectReason(e.target.value)}
              rows={3}
              className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal resize-none"
            />
          </div>
          <button
            onClick={handleCorrect}
            disabled={!correctField || !correctNewValue || !correctReason}
            className="w-full bg-signal hover:bg-signal-dim disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-md transition-colors"
          >
            确认修正
          </button>
        </div>
      </Modal>

      <Modal isOpen={showReview} onClose={() => setShowReview(false)} title="添加复核">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">复核结果</label>
            <div className="flex gap-3">
              <button
                onClick={() => setReviewResult('pass')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  reviewResult === 'pass'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-slate-bg border border-iron-lighter text-slate-300'
                }`}
              >
                通过
              </button>
              <button
                onClick={() => setReviewResult('questioned')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  reviewResult === 'questioned'
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'bg-slate-bg border border-iron-lighter text-slate-300'
                }`}
              >
                存疑
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1 block">复核原因（必填）</label>
            <textarea
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              rows={3}
              placeholder="请说明复核依据和结论..."
              className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal resize-none"
            />
          </div>
          <button
            onClick={handleReview}
            disabled={!reviewReason}
            className="w-full bg-signal hover:bg-signal-dim disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-md transition-colors"
          >
            提交复核
          </button>
        </div>
      </Modal>

      <Modal isOpen={showTransition} onClose={() => setShowTransition(false)} title="状态变更">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">目标状态</label>
            <div className="flex items-center gap-2">
              <StatusBadge status={record.status} />
              <span className="text-slate-500">→</span>
              <StatusBadge status={transitionTarget} />
            </div>
          </div>
          {isAbnormal && !hasPassReview && transitionTarget === 'confirmed' && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-md p-3 text-sm text-orange-300">
              ⚠ 异常类型记录必须先完成复核（通过），才能变更为已确认
            </div>
          )}
          <div>
            <label className="text-sm text-slate-300 mb-1 block">变更原因（必填）</label>
            <textarea
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              rows={3}
              className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal resize-none"
            />
          </div>
          <button
            onClick={handleTransition}
            disabled={!transitionReason || (isAbnormal && !hasPassReview && transitionTarget === 'confirmed')}
            className="w-full bg-signal hover:bg-signal-dim disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-md transition-colors"
          >
            确认变更
          </button>
        </div>
      </Modal>
    </div>
  )
}
