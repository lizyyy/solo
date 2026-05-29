import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ListPlus, Search } from 'lucide-react'
import { useStore } from '@/store'
import { Modal, ConfirmDialog, useToast } from '@/components/Dialog'
import type { Work, WorkStatus } from '@/types'
import { WORK_STATUS_LABELS } from '@/types'

type FilterTab = 'all' | WorkStatus

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待排' },
  { key: 'queued', label: '已排' },
  { key: 'firing', label: '烧制中' },
  { key: 'completed', label: '已完成' },
  { key: 'rescheduled', label: '已改期' },
  { key: 'cancelled', label: '已取消' },
]

const emptyForm = { name: '', student_id: '', glaze_ids: [] as string[], width: 0, height: 0, depth: 0 }

export default function Works() {
  const { show, element: toastEl } = useToast()
  const { works, students, glazes, batches, loading, fetchAll, createWork, updateWork, deleteWork, enqueue } = useStore()

  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [editWork, setEditWork] = useState<Work | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [queueWork, setQueueWork] = useState<Work | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Work | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [queueForm, setQueueForm] = useState({ batch_id: '', position: 0 })

  useEffect(() => { if (works.length === 0) fetchAll() }, [])

  const pending = works.filter(w => w.status === 'pending').length
  const queued = works.filter(w => w.status === 'queued').length
  const rescheduled = works.filter(w => w.status === 'rescheduled').length

  const filtered = works
    .filter(w => filter === 'all' || w.status === filter)
    .filter(w => !search || w.name.includes(search) || (w.student_name ?? '').includes(search))

  const tabCount = (key: FilterTab) => key === 'all' ? works.length : works.filter(w => w.status === key).length

  const openEdit = (w: Work) => {
    setEditWork(w)
    setForm({ name: w.name, student_id: w.student_id, glaze_ids: [...w.glaze_ids], width: w.width, height: w.height, depth: w.depth })
  }

  const openAdd = () => { setAddOpen(true); setForm(emptyForm) }

  const handleSubmit = async () => {
    if (!form.name.trim()) { show('请输入作品名称', 'warning'); return }
    if (!form.student_id) { show('请选择学员', 'warning'); return }
    if (editWork) {
      const res = await updateWork(editWork.id, form)
      if (res) { show('更新成功'); setEditWork(null) } else show('更新失败', 'error')
    } else {
      const res = await createWork(form)
      if (res) { show('创建成功'); setAddOpen(false); setForm(emptyForm) } else show('创建失败', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ok = await deleteWork(deleteTarget.id)
    if (ok) { show('已删除'); setDeleteTarget(null) } else show('删除失败', 'error')
  }

  const handleEnqueue = async () => {
    if (!queueWork || !queueForm.batch_id) { show('请选择批次', 'warning'); return }
    const { conflicts } = await enqueue(queueWork.id, queueForm.batch_id, queueForm.position || undefined)
    if (conflicts.length > 0) show(`入列成功，存在 ${conflicts.length} 个冲突`, 'warning')
    else show('入列成功')
    setQueueWork(null)
    setQueueForm({ batch_id: '', position: 0 })
  }

  const toggleGlaze = (gid: string) => {
    setForm(f => ({
      ...f,
      glaze_ids: f.glaze_ids.includes(gid) ? f.glaze_ids.filter(id => id !== gid) : [...f.glaze_ids, gid],
    }))
  }

  const glazeColor = (id: string) => glazes.find(g => g.id === id)?.color ?? '#ccc'

  const openBatches = batches.filter(b => b.status === 'open')

  return (
    <div className="space-y-6">
      {toastEl}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '总作品', value: works.length, color: 'text-clay-500' },
          { label: '待排', value: pending, color: 'text-clay-400' },
          { label: '已排', value: queued, color: 'text-blue-600' },
          { label: '已改期', value: rescheduled, color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className={`text-2xl font-bold font-serif ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate2-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-clay-50 rounded-lg p-1">
          {FILTER_TABS.map(t => (
            <button key={t.key} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === t.key ? 'bg-white shadow-sm text-clay-700' : 'text-slate2-400 hover:text-slate2-600'}`} onClick={() => setFilter(t.key)}>
              {t.label}<span className="ml-1 text-xs opacity-70">{tabCount(t.key)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate2-300" />
            <input className="input-field pl-9 w-48" placeholder="搜索作品/学员" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary btn-sm flex items-center gap-1" onClick={openAdd}>
            <Plus className="w-4 h-4" /> 添加作品
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate2-400">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate2-400">暂无作品</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-clay-50 text-left">
                {['作品名称', '学员', '釉料', '尺寸', '状态', '创建时间', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 font-serif font-semibold text-slate2-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => (
                <tr key={w.id} className={`border-t border-clay-50 ${i % 2 ? 'bg-clay-50/30' : ''} hover:bg-clay-50/60 transition-colors`}>
                  <td className="px-4 py-3 font-medium text-slate2-700">{w.name}</td>
                  <td className="px-4 py-3 text-slate2-500">{w.student_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 items-center">
                      {w.glaze_ids.map(gid => (
                        <span key={gid} className="inline-flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full border border-clay-200" style={{ backgroundColor: glazeColor(gid) }} />
                          <span className="text-xs text-slate2-500">{glazes.find(g => g.id === gid)?.name}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate2-500">{w.width}×{w.height}×{w.depth}</td>
                  <td className="px-4 py-3"><span className={`badge-${w.status}`}>{WORK_STATUS_LABELS[w.status]}</span></td>
                  <td className="px-4 py-3 text-slate2-400 text-xs">{new Date(w.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-clay-400 hover:text-clay-600 transition-colors" title="编辑" onClick={() => openEdit(w)}><Pencil className="w-4 h-4" /></button>
                      <button className="text-kiln-400 hover:text-kiln-600 transition-colors" title="删除" onClick={() => setDeleteTarget(w)}><Trash2 className="w-4 h-4" /></button>
                      {(w.status === 'pending' || w.status === 'rescheduled') && (
                        <button className="text-blue-500 hover:text-blue-700 transition-colors" title="入列" onClick={() => { setQueueWork(w); setQueueForm({ batch_id: '', position: 0 }) }}><ListPlus className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={addOpen || !!editWork} onClose={() => { setAddOpen(false); setEditWork(null) }} title={editWork ? '编辑作品' : '添加作品'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">作品名称</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="输入作品名称" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">学员</label>
            <select className="select-field" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
              <option value="">选择学员</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">釉料</label>
            <div className="flex flex-wrap gap-2">
              {glazes.map(g => (
                <label key={g.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${form.glaze_ids.includes(g.id) ? 'border-clay-400 bg-clay-50' : 'border-clay-100 hover:border-clay-200'}`}>
                  <input type="checkbox" className="sr-only" checked={form.glaze_ids.includes(g.id)} onChange={() => toggleGlaze(g.id)} />
                  <span className="w-3 h-3 rounded-full border border-clay-200" style={{ backgroundColor: g.color }} />
                  <span className="text-sm text-slate2-600">{g.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate2-600 mb-1">宽 (cm)</label>
              <input type="number" className="input-field" value={form.width || ''} onChange={e => setForm(f => ({ ...f, width: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate2-600 mb-1">高 (cm)</label>
              <input type="number" className="input-field" value={form.height || ''} onChange={e => setForm(f => ({ ...f, height: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate2-600 mb-1">深 (cm)</label>
              <input type="number" className="input-field" value={form.depth || ''} onChange={e => setForm(f => ({ ...f, depth: +e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => { setAddOpen(false); setEditWork(null) }}>取消</button>
            <button className="btn-primary" onClick={handleSubmit}>{editWork ? '保存' : '创建'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!queueWork} onClose={() => setQueueWork(null)} title="入列排期">
        <div className="space-y-4">
          <p className="text-sm text-slate2-500">将 <span className="font-medium text-slate2-700">{queueWork?.name}</span> 加入批次队列</p>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">选择批次</label>
            <select className="select-field" value={queueForm.batch_id} onChange={e => setQueueForm(f => ({ ...f, batch_id: e.target.value }))}>
              <option value="">选择开放批次</option>
              {openBatches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.kiln_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">位置（可选）</label>
            <input type="number" className="input-field" value={queueForm.position || ''} onChange={e => setQueueForm(f => ({ ...f, position: +e.target.value }))} placeholder="留空自动排位" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setQueueWork(null)}>取消</button>
            <button className="btn-primary" onClick={handleEnqueue}>确认入列</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="删除作品" message={`确定要删除「${deleteTarget?.name}」吗？此操作不可撤销。`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
