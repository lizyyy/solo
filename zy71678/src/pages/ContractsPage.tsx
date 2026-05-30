import { useState } from 'react'
import { FileText, Plus, Search, Edit2, Trash2, AlertTriangle, Clock, CheckCircle, XCircle, X, Paperclip } from 'lucide-react'
import { useLedgerStore } from '@/store'
import type { Contract, ContractStatus } from '@/types'
import { genId, formatDate, daysUntil } from '@/utils/helpers'

type TabKey = 'all' | 'active' | 'expiring' | 'expired' | 'pending'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '生效' },
  { key: 'expiring', label: '即将到期' },
  { key: 'expired', label: '已过期' },
  { key: 'pending', label: '待签署' },
]

const STATUS_ICON: Record<ContractStatus, React.ReactNode> = {
  active: <CheckCircle size={14} />,
  expiring: <Clock size={14} />,
  expired: <XCircle size={14} />,
  pending: <AlertTriangle size={14} />,
}

const STATUS_LABEL: Record<ContractStatus, string> = {
  active: '生效',
  expiring: '即将到期',
  expired: '已过期',
  pending: '待签署',
}

const AUTH_TYPE_OPTIONS = ['独家授权', '非独家授权', '待签署']

function computeStatus(startDate: string, endDate: string): ContractStatus {
  if (!startDate || !endDate) return 'pending'
  const diff = daysUntil(endDate)
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'expiring'
  return 'active'
}

interface FormState {
  contractNo: string
  licensor: string
  licensee: string
  authType: string
  startDate: string
  endDate: string
  attachments: string
}

const EMPTY_FORM: FormState = {
  contractNo: '',
  licensor: '',
  licensee: '',
  authType: '独家授权',
  startDate: '',
  endDate: '',
  attachments: '',
}

export default function ContractsPage() {
  const { contracts, addContract, updateContract, deleteContract } = useLedgerStore()

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = contracts.filter(c => {
    if (tab !== 'all' && c.status !== tab) return false
    if (search) {
      const q = search.toLowerCase()
      return c.contractNo.toLowerCase().includes(q) || c.licensor.toLowerCase().includes(q) || c.licensee.toLowerCase().includes(q)
    }
    return true
  })

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(c: Contract) {
    setEditingId(c.id)
    setForm({
      contractNo: c.contractNo,
      licensor: c.licensor,
      licensee: c.licensee,
      authType: c.authType,
      startDate: c.startDate,
      endDate: c.endDate,
      attachments: c.attachments.join(', '),
    })
    setModalOpen(true)
  }

  function handleSave() {
    const attachmentsArr = form.attachments ? form.attachments.split(',').map(s => s.trim()).filter(Boolean) : []
    const status = computeStatus(form.startDate, form.endDate)

    if (editingId) {
      updateContract(editingId, {
        contractNo: form.contractNo,
        licensor: form.licensor,
        licensee: form.licensee,
        authType: form.authType,
        startDate: form.startDate,
        endDate: form.endDate,
        status,
        attachments: attachmentsArr,
      })
    } else {
      addContract({
        id: genId('c'),
        contractNo: form.contractNo,
        licensor: form.licensor,
        licensee: form.licensee,
        authType: form.authType,
        startDate: form.startDate,
        endDate: form.endDate,
        status,
        attachments: attachmentsArr,
      })
    }

    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function handleDelete(id: string) {
    deleteContract(id)
    setConfirmId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-serif-title text-2xl font-semibold text-forest-700 flex items-center gap-2">
          <FileText size={24} />
          授权合同
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
            <input
              type="text"
              className="input-field pl-9 w-56"
              placeholder="搜索合同号/授权方/被授权方"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary flex items-center gap-1.5" onClick={openAdd}>
            <Plus size={16} />
            新增合同
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-warm-200">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-amber-400 text-amber-600'
                : 'border-transparent text-warm-500 hover:text-warm-700'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-warm-400">
          <FileText size={48} className="mx-auto mb-3 opacity-40" />
          <p>暂无合同数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const diff = daysUntil(c.endDate)
            const isExpired = c.status === 'expired'
            const isExpiring = c.status === 'expiring'

            return (
              <div key={c.id} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold text-forest-700">{c.contractNo}</p>
                    <p className="text-sm text-warm-500 mt-0.5">
                      {c.licensor} → {c.licensee}
                    </p>
                  </div>
                  <span className={`badge-${c.status} flex items-center gap-1`}>
                    {STATUS_ICON[c.status]}
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>

                <span className={`badge text-xs ${
                  c.authType === '独家授权'
                    ? 'bg-forest-50 text-forest-700'
                    : c.authType === '非独家授权'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-gray-50 text-gray-600'
                }`}>
                  {c.authType}
                </span>

                <div className="text-sm text-warm-600 space-y-1">
                  <div className="flex justify-between">
                    <span>起始日期</span>
                    <span>{formatDate(c.startDate) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>截止日期</span>
                    <span>{formatDate(c.endDate) || '-'}</span>
                  </div>
                  {c.endDate && (
                    <div className="flex justify-end">
                      {isExpired ? (
                        <span className="text-red-600 text-xs font-medium">已过期 {Math.abs(diff)} 天</span>
                      ) : isExpiring ? (
                        <span className="text-amber-600 text-xs font-medium">剩余 {diff} 天</span>
                      ) : diff !== Infinity ? (
                        <span className="text-warm-400 text-xs">剩余 {diff} 天</span>
                      ) : null}
                    </div>
                  )}
                </div>

                {isExpired && (
                  <div className="risk-high flex items-start gap-2 text-sm text-red-700">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>卡在合同续签：合同 {c.contractNo} 已于 {c.endDate} 到期，需续签后才能继续发行</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-warm-100">
                  <span className="flex items-center gap-1 text-xs text-warm-400">
                    <Paperclip size={12} />
                    {c.attachments.length} 个附件
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="p-1.5 rounded-md text-warm-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      onClick={() => openEdit(c)}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="p-1.5 rounded-md text-warm-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => setConfirmId(c.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="card w-full max-w-lg mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-title text-lg font-semibold text-forest-700">
                {editingId ? '编辑合同' : '新增合同'}
              </h2>
              <button className="p-1 rounded-md text-warm-400 hover:text-warm-600" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-field">合同编号</label>
                <input
                  className="input-field"
                  value={form.contractNo}
                  onChange={e => setForm(f => ({ ...f, contractNo: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">授权方</label>
                  <input
                    className="input-field"
                    value={form.licensor}
                    onChange={e => setForm(f => ({ ...f, licensor: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">被授权方</label>
                  <input
                    className="input-field"
                    value={form.licensee}
                    onChange={e => setForm(f => ({ ...f, licensee: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label-field">授权类型</label>
                <select
                  className="select-field"
                  value={form.authType}
                  onChange={e => setForm(f => ({ ...f, authType: e.target.value }))}
                >
                  {AUTH_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">起始日期</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-field">截止日期</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label-field">附件（逗号分隔）</label>
                <input
                  className="input-field"
                  placeholder="文件1.pdf, 文件2.docx"
                  value={form.attachments}
                  onChange={e => setForm(f => ({ ...f, attachments: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setModalOpen(false)}>取消</button>
              <button className="btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="card w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-warm-700">
                确定删除合同「{contracts.find(c => c.id === confirmId)?.contractNo}」吗？关联的平台授权也会受影响。
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setConfirmId(null)}>取消</button>
              <button className="btn-danger" onClick={() => handleDelete(confirmId)}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
