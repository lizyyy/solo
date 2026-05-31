import { useState } from 'react'
import { useReconciliationStore } from '@/store/useReconciliationStore'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Swords,
  MessageSquare,
  Mail,
  FileText,
  Plus,
} from 'lucide-react'
import type { ReconciliationStatus } from '@/types'
import { STATUS_LABELS, SOURCE_LABELS } from '@/types'

const STATUS_CONFIG: Record<
  ReconciliationStatus,
  { color: string; bg: string; icon: React.ReactNode }
> = {
  matched: {
    color: 'text-green-700',
    bg: 'bg-green-50',
    icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
  },
  diff: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
  },
  pending: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    icon: <HelpCircle className="w-5 h-5 text-blue-600" />,
  },
  overridden: {
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    icon: <RotateCcw className="w-5 h-5 text-purple-600" />,
  },
  conflict: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    icon: <Swords className="w-5 h-5 text-red-600" />,
  },
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getRecordById, updateVerdict, revertVerdict, addNote } =
    useReconciliationStore()

  const record = getRecordById(id || '')

  const [showVerdictPanel, setShowVerdictPanel] = useState(false)
  const [verdictChoice, setVerdictChoice] =
    useState<ReconciliationStatus>('matched')
  const [verdictReason, setVerdictReason] = useState('')
  const [newNote, setNewNote] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('阿宁')

  if (!record) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm mb-4">记录不存在</p>
          <button
            onClick={() => navigate('/')}
            className="text-amber-600 hover:text-amber-700 text-sm"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[record.status]

  const handleVerdict = () => {
    if (verdictReason.trim()) {
      updateVerdict(record.id, verdictChoice, verdictReason.trim())
      setShowVerdictPanel(false)
      setVerdictReason('')
    }
  }

  const handleRevert = () => {
    if (window.confirm('确定回退到自动判定结果？')) {
      revertVerdict(record.id)
    }
  }

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNote(record.id, newNote.trim(), noteAuthor.trim() || '阿宁')
      setNewNote('')
    }
  }

  const formatAmount = (v: number | null) =>
    v === null ? '—' : v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })

  const diffFields: {
    label: string
    flow: React.ReactNode
    contract: React.ReactNode
    isDiff: boolean
  }[] = [
    {
      label: '金额',
      flow: formatAmount(record.flowAmount),
      contract: formatAmount(record.contractAmount),
      isDiff: record.flowAmount !== record.contractAmount,
    },
    {
      label: '医保金额',
      flow: formatAmount(record.insuranceAmount),
      contract: record.contractAmount !== null
        ? formatAmount(
            Math.round(record.contractAmount * 0.9 * 100) / 100
          )
        : '—',
      isDiff:
        record.insuranceAmount !== null &&
        record.contractAmount !== null &&
        record.insuranceAmount !==
          Math.round(record.contractAmount * 0.9 * 100) / 100,
    },
  ]

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <header className="bg-[#1a1a2e] text-white px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold">
            {record.pharmacyName || '（空名称）'}
          </h1>
          <p className="text-xs text-zinc-400 font-mono">{record.flowNo}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-sm ${cfg.bg} ${cfg.color} font-medium`}
          >
            {cfg.icon}
            {STATUS_LABELS[record.status]}
          </span>
          {record.manualVerdict && (
            <span className="text-xs text-zinc-400">
              （自动判定: {STATUS_LABELS[record.autoVerdict]}）
            </span>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-lg border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            差异对比
          </h2>
          <div className="grid grid-cols-[1fr_1fr] gap-4">
            <div>
              <h3 className="text-xs font-medium text-zinc-500 mb-2 pb-1 border-b border-zinc-100">
                收款流水
              </h3>
              {diffFields.map((f) => (
                <div
                  key={f.label}
                  className={`flex justify-between py-1.5 text-sm ${f.isDiff ? 'bg-amber-50 px-2 -mx-2 rounded' : ''}`}
                >
                  <span className="text-zinc-500">{f.label}</span>
                  <span className="font-mono text-zinc-800">{f.flow}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-medium text-zinc-500 mb-2 pb-1 border-b border-zinc-100">
                合同扫描件
              </h3>
              {diffFields.map((f) => (
                <div
                  key={f.label}
                  className={`flex justify-between py-1.5 text-sm ${f.isDiff ? 'bg-amber-50 px-2 -mx-2 rounded' : ''}`}
                >
                  <span className="text-zinc-500">{f.label}</span>
                  <span
                    className={`font-mono ${f.isDiff ? 'text-amber-700 font-semibold' : 'text-zinc-800'}`}
                  >
                    {f.contract}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {record.diffAmount !== null && record.diffAmount !== 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
              <span className="text-amber-800 font-semibold">
                差异额：{record.diffAmount > 0 ? '+' : ''}
                {formatAmount(record.diffAmount)} 元
              </span>
              <span className="text-amber-600 ml-2 text-xs">
                （流水金额 − 合同金额）
              </span>
            </div>
          )}
          {record.status === 'pending' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              关键字段存在空值，无法自动比对，请补充合同金额或医保金额后重新判定
            </div>
          )}
          {record.status === 'conflict' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              重复导入时产生冲突，请人工确认后改判
            </div>
          )}
          <div className="mt-3 text-xs text-zinc-400">
            来源：{SOURCE_LABELS[record.source]} · 更新时间：
            {new Date(record.updatedAt).toLocaleString('zh-CN')}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-6">
          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              收款流水明细
            </h2>
            {record.paymentFlows.length === 0 ? (
              <p className="text-xs text-zinc-400">无流水记录</p>
            ) : (
              record.paymentFlows.map((pf) => (
                <div
                  key={pf.id}
                  className="border border-zinc-100 rounded p-3 mb-2"
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-mono text-xs text-zinc-500">
                      {pf.flowNo}
                    </span>
                    <span className="font-mono font-semibold text-zinc-800">
                      {formatAmount(pf.amount)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    日期：{pf.payDate || '—'} · 类型：{pf.payType || '—'}
                  </div>
                  {pf.remark && (
                    <div className="text-xs text-zinc-400 mt-1">
                      {pf.remark}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>

          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              审批邮件与退款
            </h2>
            {record.approvalMails.length === 0 &&
            record.refundRequests.length === 0 ? (
              <p className="text-xs text-zinc-400">无审批记录</p>
            ) : (
              <>
                {record.approvalMails.map((mail) => (
                  <div
                    key={mail.id}
                    className="border border-zinc-100 rounded p-3 mb-2"
                  >
                    <div className="text-sm font-medium text-zinc-700 mb-1">
                      {mail.mailSubject}
                    </div>
                    <div className="text-xs text-zinc-500 mb-1">
                      来自：{mail.mailFrom} · {mail.mailDate}
                    </div>
                    <div className="text-xs text-zinc-600 bg-zinc-50 rounded px-2 py-1">
                      {mail.mailSummary}
                    </div>
                  </div>
                ))}
                {record.refundRequests.map((rf) => (
                  <div
                    key={rf.id}
                    className="border border-amber-100 rounded p-3 mb-2 bg-amber-50/30"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-mono text-xs text-zinc-500">
                        {rf.refundNo}
                      </span>
                      <span className="font-mono text-amber-700 font-semibold">
                        -{formatAmount(rf.refundAmount)}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      日期：{rf.refundDate || '—'} · 状态：
                      {rf.status || '—'}
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>

        <section className="bg-white rounded-lg border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            备注
          </h2>
          {record.notes.length === 0 ? (
            <p className="text-xs text-zinc-400 mb-3">暂无备注</p>
          ) : (
            <div className="space-y-2 mb-3">
              {record.notes.map((note) => (
                <div
                  key={note.id}
                  className="border border-zinc-100 rounded p-3"
                >
                  <div className="text-sm text-zinc-700">{note.content}</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {note.author} ·{' '}
                    {new Date(note.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={noteAuthor}
              onChange={(e) => setNoteAuthor(e.target.value)}
              className="w-24 px-2 py-1.5 border border-zinc-200 rounded text-xs"
              placeholder="署名"
            />
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              className="flex-1 px-3 py-1.5 border border-zinc-200 rounded text-sm"
              placeholder="添加备注..."
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="px-3 py-1.5 bg-[#1a1a2e] text-white text-xs rounded hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-700">改判与回退</h2>
            {record.manualVerdict && (
              <button
                onClick={handleRevert}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                回退到自动判定
              </button>
            )}
          </div>

          {record.manualVerdict && (
            <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded text-sm">
              <span className="text-purple-800">
                已改判为：{STATUS_LABELS[record.manualVerdict]}
              </span>
              {record.verdictReason && (
                <span className="text-purple-600 ml-2 text-xs">
                  理由：{record.verdictReason}
                </span>
              )}
            </div>
          )}

          {!showVerdictPanel ? (
            <button
              onClick={() => setShowVerdictPanel(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded transition-colors"
            >
              改判
            </button>
          ) : (
            <div className="border border-zinc-200 rounded p-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">
                  改判结果
                </label>
                <div className="flex gap-2">
                  {(
                    ['matched', 'diff', 'pending'] as ReconciliationStatus[]
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setVerdictChoice(s)}
                      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                        verdictChoice === s
                          ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} border-current`
                          : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">
                  改判理由（必填）
                </label>
                <textarea
                  value={verdictReason}
                  onChange={(e) => setVerdictReason(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded text-sm resize-none"
                  rows={2}
                  placeholder="请输入改判理由..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleVerdict}
                  disabled={!verdictReason.trim()}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  确认改判
                </button>
                <button
                  onClick={() => {
                    setShowVerdictPanel(false)
                    setVerdictReason('')
                  }}
                  className="px-4 py-1.5 border border-zinc-200 text-zinc-500 text-sm rounded hover:bg-zinc-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
