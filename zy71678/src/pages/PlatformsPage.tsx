import { useState } from 'react'
import { Globe, Plus, Search, Edit2, Trash2, AlertTriangle, X, Shield, ShieldAlert } from 'lucide-react'
import { useLedgerStore } from '@/store'
import type { Platform, PlatformStatus } from '@/types'
import { genId, formatDate } from '@/utils/helpers'

const TYPE_OPTIONS = ['流媒体', '短视频', '社交媒体', '实体唱片'] as const
const REGION_OPTIONS = ['中国大陆', '港澳台', '东南亚', '全球'] as const

const STATUS_BADGE: Record<PlatformStatus, string> = {
  active: 'badge-active',
  expired: 'badge-expired',
  pending: 'badge-pending',
}

const STATUS_LABEL: Record<PlatformStatus, string> = {
  active: '授权有效',
  expired: '已过期',
  pending: '待生效',
}

interface FormData {
  name: string
  type: string
  region: string
  contractId: string
  startDate: string
  endDate: string
}

const emptyForm: FormData = {
  name: '',
  type: TYPE_OPTIONS[0],
  region: REGION_OPTIONS[0],
  contractId: '',
  startDate: '',
  endDate: '',
}

function computeStatus(endDate: string): PlatformStatus {
  if (!endDate) return 'pending'
  const now = new Date()
  const end = new Date(endDate)
  if (end < now) return 'expired'
  return 'active'
}

export default function PlatformsPage() {
  const { platforms, contracts, samples, releases, addPlatform, updatePlatform, deletePlatform } = useLedgerStore()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Platform | null>(null)

  const filtered = platforms.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.region.toLowerCase().includes(search.toLowerCase()) ||
    p.type.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = TYPE_OPTIONS.reduce<Record<string, Platform[]>>((acc, t) => {
    acc[t] = filtered.filter(p => p.type === t)
    return acc
  }, {})

  const otherTypes = Array.from(new Set(filtered.filter(p => !TYPE_OPTIONS.includes(p.type as any)).map(p => p.type)))
  for (const t of otherTypes) {
    grouped[t] = filtered.filter(p => p.type === t)
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(p: Platform) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      type: p.type,
      region: p.region,
      contractId: p.contractId,
      startDate: p.startDate,
      endDate: p.endDate,
    })
    setShowModal(true)
  }

  function handleSave() {
    const status = computeStatus(form.endDate)
    if (editingId) {
      updatePlatform(editingId, { ...form, status })
    } else {
      addPlatform({ id: genId('p'), ...form, status })
    }
    setShowModal(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleDelete() {
    if (deleteTarget) {
      deletePlatform(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  const oversteps: { releaseTitle: string; platformName: string; contractNo: string }[] = []
  for (const rel of releases) {
    const sample = samples.find(s => s.id === rel.sampleId)
    if (!sample) continue
    const contract = contracts.find(c => c.id === sample.contractId)
    if (!contract) continue
    const authorizedIds = platforms
      .filter(p => p.contractId === contract.id && p.status === 'active')
      .map(p => p.id)
    for (const pid of rel.platformIds) {
      if (!authorizedIds.includes(pid)) {
        const p = platforms.find(pl => pl.id === pid)
        if (p) {
          oversteps.push({
            releaseTitle: rel.title,
            platformName: p.name,
            contractNo: contract.contractNo,
          })
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-forest-800 font-serif-title flex items-center gap-2">
          <Globe className="w-6 h-6 text-amber-500" />
          平台范围
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <input
              type="text"
              placeholder="搜索平台名称、区域、类型..."
              className="input-field pl-9 w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary flex items-center gap-1.5" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            新增平台
          </button>
        </div>
      </div>

      {Object.entries(grouped)
        .filter(([, items]) => items.length > 0)
        .map(([type, items]) => (
          <section key={type} className="space-y-3">
            <h2 className="text-lg font-semibold text-forest-700 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              {type}
              <span className="text-sm font-normal text-warm-500">({items.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(p => {
                const contract = contracts.find(c => c.id === p.contractId)
                const isExpired = p.status === 'expired'
                return (
                  <div
                    key={p.id}
                    className={`card p-4 space-y-3 ${isExpired ? 'border-red-400 border-2' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-forest-800">{p.name}</h3>
                        <p className="text-sm text-warm-500">{p.region}</p>
                      </div>
                      <span className={STATUS_BADGE[p.status]}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>

                    {contract && (
                      <p className="text-sm text-warm-600">
                        合同编号：<span className="font-medium text-forest-700">{contract.contractNo}</span>
                      </p>
                    )}

                    <p className="text-sm text-warm-600">
                      授权期限：{formatDate(p.startDate)} ~ {formatDate(p.endDate)}
                    </p>

                    {isExpired && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        授权已过期
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-warm-200">
                      <button
                        className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5"
                        onClick={() => openEdit(p)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        编辑
                      </button>
                      <button
                        className="btn-danger flex items-center gap-1 text-xs px-3 py-1.5"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}

      {oversteps.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-forest-700 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            越界检测
          </h2>
          <div className="space-y-3">
            {oversteps.map((o, i) => (
              <div key={i} className="card border-l-4 border-l-red-500 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-forest-800">
                    发行「{o.releaseTitle}」
                  </p>
                  <p className="text-sm text-red-600">
                    平台越界：{o.platformName} 未在合同 {o.contractNo} 授权范围内，需补充平台授权
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-lg mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-forest-800 font-serif-title">
                {editingId ? '编辑平台' : '新增平台'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-warm-400 hover:text-warm-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-field">平台名称</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label-field">平台类型</label>
                <select
                  className="select-field"
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                >
                  {TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-field">授权区域</label>
                <select
                  className="select-field"
                  value={form.region}
                  onChange={e => setForm({ ...form, region: e.target.value })}
                >
                  {REGION_OPTIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-field">关联合同</label>
                <select
                  className="select-field"
                  value={form.contractId}
                  onChange={e => setForm({ ...form, contractId: e.target.value })}
                >
                  <option value="">请选择合同</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.contractNo} - {c.licensor}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">授权开始日期</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">授权结束日期</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={!form.name || !form.contractId || !form.startDate || !form.endDate}
              >
                {editingId ? '保存修改' : '确认新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-forest-800">确认删除</h3>
            </div>
            <p className="text-sm text-warm-600">
              确定移除平台「{deleteTarget.name}」的授权记录吗？
            </p>
            <div className="flex items-center justify-end gap-3">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                取消
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
