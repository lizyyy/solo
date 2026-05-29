import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '@/store'
import { Modal, ConfirmDialog, useToast } from '@/components/Dialog'
import type { Glaze, GlazeConflict } from '@/types'

const emptyGlaze = { name: '', firing_temp: 1200, color: '#A0522D', notes: '' }
const emptyConflict = { glaze_a_id: '', glaze_b_id: '', reason: '' }

export default function Glazes() {
  const { show, element: toastEl } = useToast()
  const { glazes, glazeConflicts, loading, fetchAll, createGlaze, updateGlaze, deleteGlaze, createGlazeConflict, deleteGlazeConflict } = useStore()

  const [tab, setTab] = useState<'glazes' | 'conflicts'>('glazes')
  const [glazeModal, setGlazeModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Glaze | null>(null)
  const [gForm, setGForm] = useState(emptyGlaze)
  const [deleteTarget, setDeleteTarget] = useState<Glaze | null>(null)

  const [cfModal, setCfModal] = useState(false)
  const [cfForm, setCfForm] = useState(emptyConflict)
  const [deleteCf, setDeleteCf] = useState<GlazeConflict | null>(null)

  useEffect(() => { if (glazes.length === 0) fetchAll() }, [])

  const openAddGlaze = () => { setGlazeModal(true); setEditTarget(null); setGForm(emptyGlaze) }
  const openEditGlaze = (g: Glaze) => { setGlazeModal(true); setEditTarget(g); setGForm({ name: g.name, firing_temp: g.firing_temp, color: g.color, notes: g.notes }) }

  const handleGlazeSubmit = async () => {
    if (!gForm.name.trim()) { show('请输入釉料名称', 'warning'); return }
    const res = editTarget
      ? await updateGlaze(editTarget.id, gForm)
      : await createGlaze(gForm)
    if (res) { show(editTarget ? '更新成功' : '创建成功'); setGlazeModal(false); setEditTarget(null) }
    else show('操作失败', 'error')
  }

  const handleDeleteGlaze = async () => {
    if (!deleteTarget) return
    const ok = await deleteGlaze(deleteTarget.id)
    if (ok) { show('已删除'); setDeleteTarget(null) } else show('删除失败', 'error')
  }

  const openAddConflict = () => { setCfModal(true); setCfForm(emptyConflict) }

  const handleConflictSubmit = async () => {
    if (!cfForm.glaze_a_id || !cfForm.glaze_b_id) { show('请选择两种釉料', 'warning'); return }
    if (cfForm.glaze_a_id === cfForm.glaze_b_id) { show('不能选择相同釉料', 'warning'); return }
    if (!cfForm.reason.trim()) { show('请输入冲突原因', 'warning'); return }
    const res = await createGlazeConflict(cfForm)
    if (res) { show('规则已添加'); setCfModal(false) } else show('添加失败', 'error')
  }

  const handleDeleteConflict = async () => {
    if (!deleteCf) return
    const ok = await deleteGlazeConflict(deleteCf.id)
    if (ok) { show('已删除'); setDeleteCf(null) } else show('删除失败', 'error')
  }

  const tabs = [{ key: 'glazes' as const, label: '釉料列表' }, { key: 'conflicts' as const, label: '冲突规则' }]

  return (
    <div className="space-y-6">
      {toastEl}

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-clay-50 rounded-lg p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-clay-700 shadow-sm' : 'text-slate2-400 hover:text-slate2-600'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button className="btn-primary btn-sm flex items-center gap-1"
          onClick={tab === 'glazes' ? openAddGlaze : openAddConflict}>
          <Plus className="w-4 h-4" /> {tab === 'glazes' ? '添加釉料' : '添加规则'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate2-400">加载中…</div>
      ) : tab === 'glazes' ? (
        glazes.length === 0 ? (
          <div className="text-center py-12 text-slate2-400">暂无釉料</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {glazes.map(g => (
              <div key={g.id} className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full inline-block border border-clay-200 shrink-0" style={{ backgroundColor: g.color }} />
                    <h3 className="font-serif font-semibold text-slate2-700">{g.name}</h3>
                  </div>
                  <span className="bg-kiln-50 text-kiln-500 px-2 py-0.5 rounded-full text-xs font-medium">{g.firing_temp}°C</span>
                </div>
                {g.notes && <p className="text-sm text-slate2-500 mb-3 line-clamp-2">{g.notes}</p>}
                <div className="flex justify-end gap-2 pt-2 border-t border-clay-50">
                  <button className="btn-secondary btn-sm flex items-center gap-1" onClick={() => openEditGlaze(g)}>
                    <Pencil className="w-3 h-3" /> 编辑
                  </button>
                  <button className="btn-danger btn-sm flex items-center gap-1" onClick={() => setDeleteTarget(g)}>
                    <Trash2 className="w-3 h-3" /> 删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        glazeConflicts.length === 0 ? (
          <div className="text-center py-12 text-slate2-400">暂无冲突规则</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-clay-50 text-left text-slate2-500">
                  <th className="px-5 py-3 font-medium">釉料 A</th>
                  <th className="px-5 py-3 font-medium">釉料 B</th>
                  <th className="px-5 py-3 font-medium">冲突原因</th>
                  <th className="px-5 py-3 font-medium w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-50">
                {glazeConflicts.map(c => (
                  <tr key={c.id} className="hover:bg-clay-50/50">
                    <td className="px-5 py-3 font-medium text-slate2-700">{c.glaze_a_name || c.glaze_a_id}</td>
                    <td className="px-5 py-3 font-medium text-slate2-700">{c.glaze_b_name || c.glaze_b_id}</td>
                    <td className="px-5 py-3 text-slate2-500">{c.reason}</td>
                    <td className="px-5 py-3">
                      <button className="text-kiln-400 hover:text-kiln-600 transition-colors" onClick={() => setDeleteCf(c)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Modal open={glazeModal} onClose={() => { setGlazeModal(false); setEditTarget(null) }} title={editTarget ? '编辑釉料' : '添加釉料'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">名称</label>
            <input className="input-field" value={gForm.name} onChange={e => setGForm(f => ({ ...f, name: e.target.value }))} placeholder="釉料名称" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">烧制温度 (°C)</label>
            <input type="number" className="input-field" value={gForm.firing_temp} onChange={e => setGForm(f => ({ ...f, firing_temp: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">颜色</label>
            <div className="flex items-center gap-3">
              <input type="color" value={gForm.color} onChange={e => setGForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded-lg border border-clay-200 cursor-pointer" />
              <input className="input-field flex-1" value={gForm.color} onChange={e => setGForm(f => ({ ...f, color: e.target.value }))} placeholder="#000000" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">备注</label>
            <textarea className="input-field min-h-[80px] resize-none" value={gForm.notes} onChange={e => setGForm(f => ({ ...f, notes: e.target.value }))} placeholder="备注信息" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => { setGlazeModal(false); setEditTarget(null) }}>取消</button>
            <button className="btn-primary" onClick={handleGlazeSubmit}>{editTarget ? '保存' : '创建'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={cfModal} onClose={() => setCfModal(false)} title="添加冲突规则">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">釉料 A</label>
            <select className="select-field" value={cfForm.glaze_a_id} onChange={e => setCfForm(f => ({ ...f, glaze_a_id: e.target.value }))}>
              <option value="">选择釉料</option>
              {glazes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">釉料 B</label>
            <select className="select-field" value={cfForm.glaze_b_id} onChange={e => setCfForm(f => ({ ...f, glaze_b_id: e.target.value }))}>
              <option value="">选择釉料</option>
              {glazes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">冲突原因</label>
            <textarea className="input-field min-h-[80px] resize-none" value={cfForm.reason} onChange={e => setCfForm(f => ({ ...f, reason: e.target.value }))} placeholder="描述冲突原因" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setCfModal(false)}>取消</button>
            <button className="btn-primary" onClick={handleConflictSubmit}>添加</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="删除釉料" message={`确定要删除「${deleteTarget?.name}」吗？`} onConfirm={handleDeleteGlaze} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!deleteCf} title="删除冲突规则" message="确定要删除此冲突规则吗？" onConfirm={handleDeleteConflict} onCancel={() => setDeleteCf(null)} />
    </div>
  )
}
