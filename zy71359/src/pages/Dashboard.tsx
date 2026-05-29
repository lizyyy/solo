import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Lock, Unlock, AlertTriangle, Flame, Box } from 'lucide-react'
import { useStore } from '@/store'
import { Modal, useToast } from '@/components/Dialog'
import type { BatchStatus, Batch } from '@/types'
import { BATCH_STATUS_LABELS } from '@/types'

type FilterTab = 'all' | BatchStatus

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '开放' },
  { key: 'locked', label: '已锁定' },
  { key: 'firing', label: '烧制中' },
  { key: 'completed', label: '已完成' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { show, element: toastEl } = useToast()
  const { batches, works, loading, fetchAll, createBatch, lockBatch, unlockBatch } = useStore()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', kiln_name: '1号窑', max_width: 60, max_height: 40, max_depth: 60 })

  useEffect(() => {
    if (batches.length === 0) fetchAll()
  }, [])

  const openBatches = batches.filter(b => b.status === 'open')
  const pendingWorks = works.filter(w => w.status === 'pending')
  const totalConflicts = batches.reduce((sum, b) => sum + (b.conflict_count ?? 0), 0)

  const filtered = filter === 'all' ? batches : batches.filter(b => b.status === filter)

  const tabCounts = (key: FilterTab) => {
    if (key === 'all') return batches.length
    return batches.filter(b => b.status === key).length
  }

  const handleLock = async (e: React.MouseEvent, batch: Batch) => {
    e.stopPropagation()
    const fn = batch.status === 'open' ? lockBatch : unlockBatch
    const res = await fn(batch.id)
    if (res) show(batch.status === 'open' ? '已锁定' : '已解锁')
    else show('操作失败', 'error')
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { show('请输入批次名称', 'warning'); return }
    const res = await createBatch(form)
    if (res) { show('创建成功'); setAddOpen(false); setForm({ name: '', kiln_name: '1号窑', max_width: 60, max_height: 40, max_depth: 60 }) }
    else show('创建失败', 'error')
  }

  const conflictBatches = batches.filter(b => (b.conflict_count ?? 0) > 0)

  return (
    <div className="space-y-6">
      {toastEl}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '总批次', value: batches.length, icon: Box, color: 'text-clay-500' },
          { label: '开放批次', value: openBatches.length, icon: Unlock, color: 'text-green-600' },
          { label: '待排作品', value: pendingWorks.length, icon: Plus, color: 'text-blue-600' },
          { label: '冲突', value: totalConflicts, icon: AlertTriangle, color: 'text-kiln-400' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <div className="text-2xl font-bold text-slate2-700 font-serif">{s.value}</div>
              <div className="text-xs text-slate2-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {conflictBatches.length > 0 && (
        <div className="bg-kiln-50 border border-kiln-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-kiln-500 font-serif font-semibold mb-3">
            <AlertTriangle className="w-5 h-5" /> 冲突预警
          </div>
          <div className="space-y-2">
            {conflictBatches.map(b => (
              <div key={b.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-kiln-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-kiln-400" />
                  <span className="text-sm font-medium text-slate2-700">{b.name}</span>
                  <span className="text-xs text-slate2-400">· {b.kiln_name}</span>
                </div>
                <span className="badge-firing">{b.conflict_count} 个冲突</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-clay-50 rounded-lg p-1">
          {FILTER_TABS.map(t => (
            <button
              key={t.key}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === t.key ? 'bg-white shadow-sm text-clay-700' : 'text-slate2-400 hover:text-slate2-600'}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              <span className="ml-1 text-xs opacity-70">{tabCounts(t.key)}</span>
            </button>
          ))}
        </div>
        <button className="btn-primary btn-sm flex items-center gap-1" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> 新建批次
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate2-400">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate2-400">暂无批次</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(batch => (
            <div key={batch.id} className="card p-5 cursor-pointer group" onClick={() => navigate(`/batch/${batch.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-serif font-semibold text-slate2-700 group-hover:text-clay-600 transition-colors">{batch.name}</h3>
                  <p className="text-xs text-slate2-400 mt-0.5">{batch.kiln_name}</p>
                </div>
                <span className={`badge-${batch.status}`}>{BATCH_STATUS_LABELS[batch.status]}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate2-500 mb-3">
                <span>作品 {batch.work_count ?? 0}</span>
                {(batch.conflict_count ?? 0) > 0 && (
                  <span className="text-kiln-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {batch.conflict_count}
                  </span>
                )}
              </div>
              <div className="w-full bg-clay-100 rounded-full h-1.5 mb-3">
                <div className="bg-clay-500 h-1.5 rounded-full transition-all" style={{ width: `${batch.status === 'completed' ? 100 : Math.min((batch.work_count ?? 0) * 10, 90)}%` }} />
              </div>
              <div className="flex justify-end">
                {(batch.status === 'open' || batch.status === 'locked') && (
                  <button className="btn-secondary btn-sm flex items-center gap-1" onClick={e => handleLock(e, batch)}>
                    {batch.status === 'open' ? <><Lock className="w-3 h-3" /> 锁定</> : <><Unlock className="w-3 h-3" /> 解锁</>}
                  </button>
                )}
                {batch.status === 'firing' && (
                  <span className="flex items-center gap-1 text-kiln-400 text-xs"><Flame className="w-3 h-3" /> 烧制中</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="新建批次">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">批次名称</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：第3期-A窑" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">窑名</label>
            <input className="input-field" value={form.kiln_name} onChange={e => setForm(f => ({ ...f, kiln_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate2-600 mb-1">最大宽</label>
              <input type="number" className="input-field" value={form.max_width} onChange={e => setForm(f => ({ ...f, max_width: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate2-600 mb-1">最大高</label>
              <input type="number" className="input-field" value={form.max_height} onChange={e => setForm(f => ({ ...f, max_height: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate2-600 mb-1">最大深</label>
              <input type="number" className="input-field" value={form.max_depth} onChange={e => setForm(f => ({ ...f, max_depth: +e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>取消</button>
            <button className="btn-primary" onClick={handleCreate}>创建</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
