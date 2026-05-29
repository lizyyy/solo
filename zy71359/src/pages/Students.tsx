import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, User } from 'lucide-react'
import { useStore } from '@/store'
import { Modal, ConfirmDialog, useToast } from '@/components/Dialog'
import type { Student } from '@/types'

const emptyForm = { name: '', phone: '', notes: '' }

export default function Students() {
  const { show, element: toastEl } = useToast()
  const { students, works, loading, fetchAll, createStudent, updateStudent, deleteStudent } = useStore()

  const [editTarget, setEditTarget] = useState<Student | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { if (students.length === 0) fetchAll() }, [])

  const workCount = (sid: string) => works.filter(w => w.student_id === sid).length

  const openEdit = (s: Student) => {
    setEditTarget(s)
    setForm({ name: s.name, phone: s.phone, notes: s.notes })
  }

  const openAdd = () => { setAddOpen(true); setForm(emptyForm) }

  const handleSubmit = async () => {
    if (!form.name.trim()) { show('请输入学员姓名', 'warning'); return }
    if (editTarget) {
      const res = await updateStudent(editTarget.id, form)
      if (res) { show('更新成功'); setEditTarget(null) } else show('更新失败', 'error')
    } else {
      const res = await createStudent(form)
      if (res) { show('创建成功'); setAddOpen(false); setForm(emptyForm) } else show('创建失败', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ok = await deleteStudent(deleteTarget.id)
    if (ok) { show('已删除'); setDeleteTarget(null) } else show('删除失败', 'error')
  }

  return (
    <div className="space-y-6">
      {toastEl}

      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-slate2-700">学员管理</h2>
        <button className="btn-primary btn-sm flex items-center gap-1" onClick={openAdd}>
          <Plus className="w-4 h-4" /> 添加学员
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate2-400">加载中…</div>
      ) : students.length === 0 ? (
        <div className="text-center py-12 text-slate2-400">暂无学员</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map(s => (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-clay-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-clay-400" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-slate2-700">{s.name}</h3>
                    {s.phone && <p className="text-xs text-slate2-400">{s.phone}</p>}
                  </div>
                </div>
                <span className="bg-clay-50 text-clay-600 px-2 py-0.5 rounded-full text-xs font-medium">{workCount(s.id)} 件</span>
              </div>
              {s.notes && <p className="text-sm text-slate2-500 mb-3 line-clamp-2">{s.notes}</p>}
              <div className="flex justify-end gap-2 pt-2 border-t border-clay-50">
                <button className="btn-secondary btn-sm flex items-center gap-1" onClick={() => openEdit(s)}>
                  <Pencil className="w-3 h-3" /> 编辑
                </button>
                <button className="btn-danger btn-sm flex items-center gap-1" onClick={() => setDeleteTarget(s)}>
                  <Trash2 className="w-3 h-3" /> 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen || !!editTarget} onClose={() => { setAddOpen(false); setEditTarget(null) }} title={editTarget ? '编辑学员' : '添加学员'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">姓名</label>
            <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="输入学员姓名" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">电话</label>
            <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="输入联系电话" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">备注</label>
            <textarea className="input-field min-h-[80px] resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="备注信息" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => { setAddOpen(false); setEditTarget(null) }}>取消</button>
            <button className="btn-primary" onClick={handleSubmit}>{editTarget ? '保存' : '创建'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="删除学员" message={`确定要删除「${deleteTarget?.name}」吗？关联的作品不受影响。`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
