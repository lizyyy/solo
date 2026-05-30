import { useState } from 'react'
import { CalendarDays, Plus, Search, Edit2, Trash2, AlertTriangle, CheckCircle, XCircle, X, Shield } from 'lucide-react'
import { useLedgerStore } from '@/store'
import type { Release, ReleaseStatus } from '@/types'
import { genId, formatDate, daysUntil } from '@/utils/helpers'

const STATUS_MAP: Record<ReleaseStatus, { label: string; badge: string }> = {
  draft: { label: '草稿', badge: 'badge-pending' },
  validated: { label: '已校验', badge: 'badge-active' },
  scheduled: { label: '已排期', badge: 'badge-info' },
  released: { label: '已发行', badge: 'badge-active' },
  blocked: { label: '被阻断', badge: 'badge-danger' },
}

const EMPTY_FORM = {
  title: '',
  releaseDate: '',
  sampleId: '',
  platformIds: [] as string[],
  status: 'draft' as ReleaseStatus,
}

export default function ReleasesPage() {
  const { releases, samples, contracts, platforms, royalties, addRelease, updateRelease, deleteRelease } = useLedgerStore()

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filtered = releases
    .filter(r => {
      const sample = samples.find(s => s.id === r.sampleId)
      const q = search.toLowerCase()
      return r.title.toLowerCase().includes(q) || (sample?.title ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (r: Release) => {
    setEditingId(r.id)
    setForm({
      title: r.title,
      releaseDate: r.releaseDate,
      sampleId: r.sampleId,
      platformIds: [...r.platformIds],
      status: r.status,
    })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.title.trim() || !form.releaseDate || !form.sampleId) return
    if (editingId) {
      updateRelease(editingId, { ...form })
    } else {
      addRelease({ id: genId('rl'), ...form, validationErrors: [] })
    }
    setShowModal(false)
  }

  const handleDelete = (id: string) => {
    deleteRelease(id)
    setDeleteConfirm(null)
  }

  const handleValidate = (release: Release) => {
    const errors: string[] = []
    const sample = samples.find(s => s.id === release.sampleId)
    const contract = sample ? contracts.find(c => c.id === sample.contractId) : undefined

    if (!contract || contract.status === 'expired' || contract.status === 'pending') {
      errors.push(`卡在合同续签：合同 ${contract?.contractNo ?? '未知'} 未生效或已过期`)
    }

    if (contract) {
      const authorizedPlatformIds = platforms
        .filter(p => p.contractId === contract.id && p.status === 'active')
        .map(p => p.id)
      const unauthorized = release.platformIds.filter(pid => !authorizedPlatformIds.includes(pid))
      for (const pid of unauthorized) {
        const p = platforms.find(pl => pl.id === pid)
        if (p) {
          errors.push(`卡在平台授权：${p.name} 未在授权范围内`)
        }
      }
    }

    const sampleRoyalties = royalties.filter(r => r.sampleId === release.sampleId)
    const totalPct = sampleRoyalties.reduce((sum, r) => sum + r.percentage, 0)
    if (sampleRoyalties.length === 0 || totalPct !== 100) {
      errors.push('卡在分成配置：分成规则不完整')
    }

    if (contract && contract.endDate && release.releaseDate) {
      if (new Date(release.releaseDate) > new Date(contract.endDate)) {
        errors.push('卡在发行日期：发行日期超出授权期限')
      }
    }

    if (errors.length === 0) {
      updateRelease(release.id, { status: 'validated', validationErrors: [] })
    } else {
      updateRelease(release.id, { status: 'blocked', validationErrors: errors })
    }
  }

  const togglePlatform = (pid: string) => {
    setForm(prev => ({
      ...prev,
      platformIds: prev.platformIds.includes(pid)
        ? prev.platformIds.filter(id => id !== pid)
        : [...prev.platformIds, pid],
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold font-serif-title text-forest-800">发行计划</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <input
              type="text"
              placeholder="搜索发行计划..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            新增计划
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-warm-500">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>暂无发行计划</p>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-warm-300" />
          <div className="space-y-6">
            {filtered.map(release => {
              const sample = samples.find(s => s.id === release.sampleId)
              const days = daysUntil(release.releaseDate)
              const statusInfo = STATUS_MAP[release.status]
              return (
                <div key={release.id} className="relative">
                  <div className="absolute -left-5 top-4 w-4 h-4 rounded-full border-2 border-amber-400 bg-warm-100" />
                  <div className="card p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-forest-800 truncate">{release.title}</h3>
                          <span className={statusInfo.badge}>{statusInfo.label}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-warm-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {formatDate(release.releaseDate)}
                            {days > 0 && <span className="text-amber-600 ml-1">({days}天后)</span>}
                            {days === 0 && <span className="text-amber-600 ml-1">(今天)</span>}
                            {days < 0 && <span className="text-red-600 ml-1">(已过期)</span>}
                          </span>
                          {sample && (
                            <span>关联采样：{sample.title}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(release.status === 'draft' || release.status === 'blocked') && (
                          <button
                            onClick={() => handleValidate(release)}
                            className="btn-secondary flex items-center gap-1 text-xs"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            校验
                          </button>
                        )}
                        <button onClick={() => openEdit(release)} className="p-1.5 text-warm-500 hover:text-amber-600 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(release.id)} className="p-1.5 text-warm-500 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {release.platformIds.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-warm-500">发行平台：</span>
                        {release.platformIds.map(pid => {
                          const p = platforms.find(pl => pl.id === pid)
                          return p ? (
                            <span key={pid} className="badge-info text-xs">{p.name}</span>
                          ) : null
                        })}
                      </div>
                    )}

                    {release.status === 'blocked' && release.validationErrors.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {release.validationErrors.map((err, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-red-700">{err}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {release.status === 'validated' && (
                      <div className="flex items-center gap-2 text-green-700 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        校验通过，可安排发行
                      </div>
                    )}

                    {deleteConfirm === release.id && (
                      <div className="flex items-center gap-3 pt-2 border-t border-warm-200">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-warm-700">确定删除发行计划「{release.title}」吗？</span>
                        <button onClick={() => handleDelete(release.id)} className="btn-danger text-xs py-1 px-3">删除</button>
                        <button onClick={() => setDeleteConfirm(null)} className="btn-secondary text-xs py-1 px-3">取消</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card p-6 w-full max-w-lg mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold font-serif-title text-forest-800">
                {editingId ? '编辑发行计划' : '新增发行计划'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-warm-400 hover:text-warm-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="label-field">计划名称</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="input-field"
                placeholder="输入发行计划名称"
              />
            </div>

            <div>
              <label className="label-field">发行日期</label>
              <input
                type="date"
                value={form.releaseDate}
                onChange={e => setForm(prev => ({ ...prev, releaseDate: e.target.value }))}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-field">关联采样</label>
              <select
                value={form.sampleId}
                onChange={e => setForm(prev => ({ ...prev, sampleId: e.target.value }))}
                className="select-field"
              >
                <option value="">请选择采样</option>
                {samples.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-field">发行平台</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {platforms.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-warm-200 cursor-pointer hover:bg-warm-50 text-sm">
                    <input
                      type="checkbox"
                      checked={form.platformIds.includes(p.id)}
                      onChange={() => togglePlatform(p.id)}
                      className="rounded border-warm-300 text-amber-400 focus:ring-amber-400"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label-field">状态</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value as ReleaseStatus }))}
                className="select-field"
              >
                {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">取消</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.title.trim() || !form.releaseDate || !form.sampleId}>
                {editingId ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
