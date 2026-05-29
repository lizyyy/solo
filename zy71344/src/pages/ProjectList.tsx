import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Music, Plus, Search, Trash2, ArrowRight, Filter } from 'lucide-react'
import { useStore } from '@/store'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate } from '@/utils'
import type { Project, ConfirmStatus } from '@/types'

const statusOptions: { value: ConfirmStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'confirmed', label: '已确认' },
  { value: 'temporary', label: '临时备注' },
  { value: 'conflict', label: '冲突' },
]

function getProjectStatus(p: Project, beatMarkers: ReturnType<typeof useStore.getState>['beatMarkers'], cutPoints: ReturnType<typeof useStore.getState>['cutPoints'], formationNotes: ReturnType<typeof useStore.getState>['formationNotes'], conflicts: ReturnType<typeof useStore.getState>['conflicts']): ConfirmStatus {
  const pConflicts = conflicts.filter((c) => c.projectId === p.id)
  if (pConflicts.length > 0) return 'conflict'
  const allItems = [
    ...beatMarkers.filter((b) => b.projectId === p.id),
    ...cutPoints.filter((c) => c.projectId === p.id),
    ...formationNotes.filter((n) => n.projectId === p.id),
  ]
  if (allItems.length === 0) return 'temporary'
  if (allItems.every((i) => i.status === 'confirmed')) return 'confirmed'
  return 'temporary'
}

export function ProjectList() {
  const { projects, addProject, deleteProject, beatMarkers, cutPoints, formationNotes, conflicts } = useStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ConfirmStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = projects.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && getProjectStatus(p, beatMarkers, cutPoints, formationNotes, conflicts) !== statusFilter) return false
    return true
  })

  const handleCreate = () => {
    if (!newName.trim()) return
    addProject(newName.trim(), newDesc.trim())
    setNewName('')
    setNewDesc('')
    setShowModal(false)
  }

  const handleDelete = (id: string) => {
    deleteProject(id)
    setDeleteId(null)
  }

  const statusBarColor = (p: Project) => {
    const s = getProjectStatus(p, beatMarkers, cutPoints, formationNotes, conflicts)
    if (s === 'conflict') return 'bg-status-conflict'
    if (s === 'confirmed') return 'bg-status-confirmed'
    return 'bg-status-temporary'
  }

  return (
    <div className="min-h-screen p-8">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold text-white mb-2">舞蹈音乐切点助手</h1>
        <p className="text-gray-400 text-sm">管理你的舞蹈音乐剪辑项目</p>
      </header>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索项目..." className="input-field pl-9" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ConfirmStatus | 'all')} className="select-field pl-8 pr-8">
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />新建项目
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Music size={48} className="mb-4 opacity-30" />
          <p className="text-lg">暂无项目</p>
          <p className="text-sm mt-1">点击「新建项目」开始创作</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const beats = beatMarkers.filter((b) => b.projectId === p.id)
            const cuts = cutPoints.filter((c) => c.projectId === p.id)
            const notes = formationNotes.filter((n) => n.projectId === p.id)
            const pConflicts = conflicts.filter((c) => c.projectId === p.id)
            return (
              <div key={p.id} className="card flex overflow-hidden relative group">
                <div className={`w-1.5 shrink-0 ${statusBarColor(p)}`} />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-white font-semibold text-base truncate">{p.name}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/project/${p.id}`} className="p-1.5 rounded-md hover:bg-surface-hover text-gray-400 hover:text-white transition-colors"><ArrowRight size={14} /></Link>
                      <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-md hover:bg-status-conflict/20 text-gray-400 hover:text-status-conflict transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {p.description && <p className="text-gray-400 text-xs mb-3 line-clamp-2">{p.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    <span>{beats.length} 八拍</span>
                    <span>{cuts.length} 切点</span>
                    <span>{notes.length} 队形</span>
                    {pConflicts.length > 0 && <span className="text-status-conflict">{pConflicts.length} 冲突</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status="confirmed" size="sm" />
                    {beats.filter((b) => b.status === 'confirmed').length > 0 && <span className="text-xs text-gray-400">{beats.filter((b) => b.status === 'confirmed').length}</span>}
                    <StatusBadge status="temporary" size="sm" />
                    <StatusBadge status="conflict" size="sm" />
                  </div>
                  <p className="text-xs text-gray-500">更新于 {formatDate(p.updatedAt)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white text-lg font-semibold mb-4">新建项目</h2>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">项目名称</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="输入项目名称" className="input-field" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">项目描述</label>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="输入项目描述（可选）" rows={3} className="input-field resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-ghost">取消</button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">确认创建</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
          <div className="bg-surface-card border border-surface-border rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white text-lg font-semibold mb-2">确认删除</h2>
            <p className="text-gray-400 text-sm mb-5">删除后无法恢复，确定要删除该项目吗？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost">取消</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 rounded-lg bg-status-conflict text-white text-sm font-medium hover:bg-status-conflict/80 transition-colors">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
