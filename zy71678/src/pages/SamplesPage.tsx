import { useState } from 'react'
import { Music, Plus, Search, Edit2, Trash2, AlertTriangle, FileText, X } from 'lucide-react'
import { useLedgerStore } from '@/store'
import type { Sample, SampleStatus } from '@/types'
import { genId } from '@/utils/helpers'

const SAMPLE_TYPE_OPTIONS = ['旋律采样', '和声采样', '节奏采样', '人声采样', '歌词采样']

const STATUS_LABEL: Record<SampleStatus, string> = {
  complete: '完整',
  incomplete: '不完整',
  at_risk: '风险',
}

const STATUS_BADGE: Record<SampleStatus, string> = {
  complete: 'badge-active',
  incomplete: 'badge-warning',
  at_risk: 'badge-danger',
}

interface FormState {
  title: string
  originalWork: string
  originalArtist: string
  sampleType: string
  sourceLabel: string
  contractId: string
  notes: string
}

const EMPTY_FORM: FormState = {
  title: '',
  originalWork: '',
  originalArtist: '',
  sampleType: '旋律采样',
  sourceLabel: '',
  contractId: '',
  notes: '',
}

export default function SamplesPage() {
  const { samples, contracts, royalties, addSample, updateSample, deleteSample } = useLedgerStore()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const filtered = samples.filter(s => {
    const q = search.toLowerCase()
    return (
      s.title.toLowerCase().includes(q) ||
      s.originalWork.toLowerCase().includes(q) ||
      s.originalArtist.toLowerCase().includes(q) ||
      s.sampleType.toLowerCase().includes(q) ||
      s.sourceLabel.toLowerCase().includes(q)
    )
  })

  function getContract(contractId: string) {
    return contracts.find(c => c.id === contractId)
  }

  function getRoyaltyStatus(sample: Sample) {
    const sampleRoyalties = royalties.filter(r => sample.royaltyIds.includes(r.id))
    if (sample.royaltyIds.length === 0) {
      return { label: '未配置', badge: 'badge-danger' }
    }
    const total = sampleRoyalties.reduce((sum, r) => sum + r.percentage, 0)
    if (total < 100) {
      return { label: `不完整(${total}%)`, badge: 'badge-warning' }
    }
    return { label: '完整', badge: 'badge-active' }
  }

  function getContractAlert(sample: Sample) {
    const contract = getContract(sample.contractId)
    if (!contract) return null
    if (contract.status === 'expired') {
      return `关联合同 ${contract.contractNo} 已于 ${contract.endDate} 到期`
    }
    if (contract.status === 'expiring') {
      return `关联合同 ${contract.contractNo} 即将到期（${contract.endDate}）`
    }
    if (contract.status === 'pending') {
      return `关联合同 ${contract.contractNo} 尚未签署生效`
    }
    return null
  }

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(sample: Sample) {
    setEditingId(sample.id)
    setForm({
      title: sample.title,
      originalWork: sample.originalWork,
      originalArtist: sample.originalArtist,
      sampleType: sample.sampleType,
      sourceLabel: sample.sourceLabel,
      contractId: sample.contractId,
      notes: sample.notes,
    })
    setModalOpen(true)
  }

  function handleDelete(sample: Sample) {
    const ok = window.confirm(
      `确定删除采样「${sample.title}」吗？删除后关联的分成规则也会一并移除。`
    )
    if (ok) {
      deleteSample(sample.id)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingId) {
      updateSample(editingId, {
        title: form.title,
        originalWork: form.originalWork,
        originalArtist: form.originalArtist,
        sampleType: form.sampleType,
        sourceLabel: form.sourceLabel,
        contractId: form.contractId,
        notes: form.notes,
      })
    } else {
      addSample({
        id: genId('s'),
        title: form.title,
        originalWork: form.originalWork,
        originalArtist: form.originalArtist,
        sampleType: form.sampleType,
        sourceLabel: form.sourceLabel,
        contractId: form.contractId,
        royaltyIds: [],
        status: 'incomplete',
        notes: form.notes,
      })
    }
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="font-serif-title text-2xl font-bold text-forest-800 flex items-center gap-2">
          <Music className="text-amber-500" size={28} />
          采样清单
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" size={16} />
            <input
              type="text"
              placeholder="搜索采样..."
              className="input-field pl-9 w-48"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary flex items-center gap-1.5" onClick={openAdd}>
            <Plus size={16} />
            新增采样
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200 bg-warm-50">
                <th className="text-left px-4 py-3 text-warm-600 font-medium">采样名称</th>
                <th className="text-left px-4 py-3 text-warm-600 font-medium">原始作品</th>
                <th className="text-left px-4 py-3 text-warm-600 font-medium">原始艺人</th>
                <th className="text-left px-4 py-3 text-warm-600 font-medium">采样类型</th>
                <th className="text-left px-4 py-3 text-warm-600 font-medium">来源厂牌</th>
                <th className="text-left px-4 py-3 text-warm-600 font-medium">关联合同</th>
                <th className="text-left px-4 py-3 text-warm-600 font-medium">分成状态</th>
                <th className="text-left px-4 py-3 text-warm-600 font-medium">状态</th>
                <th className="text-right px-4 py-3 text-warm-600 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sample => {
                const contract = getContract(sample.contractId)
                const royaltyStatus = getRoyaltyStatus(sample)
                const alert = getContractAlert(sample)
                return (
                  <tr key={sample.id} className="border-b border-warm-100 hover:bg-warm-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-forest-800">
                      <div className="flex items-center gap-1.5">
                        {alert && (
                          <span title={alert} className="cursor-help">
                            <AlertTriangle className="text-amber-500 shrink-0" size={14} />
                          </span>
                        )}
                        {sample.title}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-warm-700">{sample.originalWork}</td>
                    <td className="px-4 py-3 text-warm-700">{sample.originalArtist}</td>
                    <td className="px-4 py-3 text-warm-700">{sample.sampleType}</td>
                    <td className="px-4 py-3 text-warm-700">{sample.sourceLabel}</td>
                    <td className="px-4 py-3 text-warm-700">
                      {contract ? (
                        <span className="flex items-center gap-1">
                          <FileText size={13} className="text-warm-400" />
                          {contract.contractNo}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={royaltyStatus.badge}>{royaltyStatus.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[sample.status]}>{STATUS_LABEL[sample.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded hover:bg-warm-100 text-warm-500 hover:text-forest-700 transition-colors"
                          onClick={() => openEdit(sample)}
                          title="编辑"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-red-50 text-warm-500 hover:text-red-600 transition-colors"
                          onClick={() => handleDelete(sample)}
                          title="删除"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-warm-400">
                    暂无采样数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-warm-200">
          {filtered.map(sample => {
            const contract = getContract(sample.contractId)
            const royaltyStatus = getRoyaltyStatus(sample)
            const alert = getContractAlert(sample)
            return (
              <div key={sample.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-forest-800">
                    {alert && (
                      <span title={alert} className="cursor-help">
                        <AlertTriangle className="text-amber-500 shrink-0" size={14} />
                      </span>
                    )}
                    {sample.title}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 rounded hover:bg-warm-100 text-warm-500"
                      onClick={() => openEdit(sample)}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-red-50 text-warm-500"
                      onClick={() => handleDelete(sample)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="text-warm-500">原始作品</div>
                  <div className="text-warm-800">{sample.originalWork}</div>
                  <div className="text-warm-500">原始艺人</div>
                  <div className="text-warm-800">{sample.originalArtist}</div>
                  <div className="text-warm-500">采样类型</div>
                  <div className="text-warm-800">{sample.sampleType}</div>
                  <div className="text-warm-500">来源厂牌</div>
                  <div className="text-warm-800">{sample.sourceLabel}</div>
                  <div className="text-warm-500">关联合同</div>
                  <div className="text-warm-800">
                    {contract ? contract.contractNo : '-'}
                  </div>
                  <div className="text-warm-500">分成状态</div>
                  <div><span className={royaltyStatus.badge}>{royaltyStatus.label}</span></div>
                  <div className="text-warm-500">状态</div>
                  <div><span className={STATUS_BADGE[sample.status]}>{STATUS_LABEL[sample.status]}</span></div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-warm-400">暂无采样数据</div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
              <h3 className="font-serif-title text-lg font-semibold text-forest-800">
                {editingId ? '编辑采样' : '新增采样'}
              </h3>
              <button
                className="p-1 rounded hover:bg-warm-100 text-warm-500 transition-colors"
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label-field">采样名称</label>
                <input
                  className="input-field"
                  value={form.title}
                  onChange={e => updateField('title', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-field">原始作品</label>
                <input
                  className="input-field"
                  value={form.originalWork}
                  onChange={e => updateField('originalWork', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-field">原始艺人</label>
                <input
                  className="input-field"
                  value={form.originalArtist}
                  onChange={e => updateField('originalArtist', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-field">采样类型</label>
                <select
                  className="select-field"
                  value={form.sampleType}
                  onChange={e => updateField('sampleType', e.target.value)}
                >
                  {SAMPLE_TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">来源厂牌</label>
                <input
                  className="input-field"
                  value={form.sourceLabel}
                  onChange={e => updateField('sourceLabel', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-field">关联合同</label>
                <select
                  className="select-field"
                  value={form.contractId}
                  onChange={e => updateField('contractId', e.target.value)}
                >
                  <option value="">请选择合同</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.contractNo} - {c.licensor}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">备注</label>
                <textarea
                  className="input-field min-h-[80px] resize-y"
                  value={form.notes}
                  onChange={e => updateField('notes', e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  {editingId ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
