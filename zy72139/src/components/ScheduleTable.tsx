import { useState, useEffect, useCallback } from 'react'
import { useScheduleStore, type ScheduleItem } from '@/stores/scheduleStore'
import StatusBadge, { STATUS_CONFIG } from './StatusBadge'
import {
  History, Trash2, Save, X, Pencil, AlertTriangle,
  Copy, ShieldAlert, GitBranch, FileQuestion
} from 'lucide-react'

function AnomalyTag({ item }: { item: ScheduleItem }) {
  const tags: { icon: React.ReactNode; label: string; color: string }[] = []

  if (item.status === 'version_conflict') {
    tags.push({
      icon: <GitBranch size={10} />,
      label: `版本冲突 v${item.version}`,
      color: 'bg-pink-50 text-pink-600 border-pink-200',
    })
  }
  if (item.status === 'duplicate') {
    tags.push({
      icon: <Copy size={10} />,
      label: '重复',
      color: 'bg-amber-50 text-amber-600 border-amber-200',
    })
  }
  if (item.status === 'missing_auth') {
    tags.push({
      icon: <ShieldAlert size={10} />,
      label: '缺授权',
      color: 'bg-orange-50 text-orange-600 border-orange-200',
    })
  }
  if (!item.track_name) {
    tags.push({
      icon: <FileQuestion size={10} />,
      label: '曲目名空',
      color: 'bg-red-50 text-red-600 border-red-200',
    })
  }
  if (!item.file_name) {
    tags.push({
      icon: <FileQuestion size={10} />,
      label: '文件名空',
      color: 'bg-red-50 text-red-600 border-red-200',
    })
  }
  if (item.file_name && item.track_name && !item.file_name.includes(item.track_name) && item.status !== 'version_conflict' && item.status !== 'duplicate' && item.status !== 'missing_auth') {
    const partMatch = item.file_name.startsWith(item.part_no)
    if (!partMatch) {
      tags.push({
        icon: <AlertTriangle size={10} />,
        label: '文件名不匹配',
        color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      })
    }
  }

  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((t, i) => (
        <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${t.color}`}>
          {t.icon}
          {t.label}
        </span>
      ))}
    </div>
  )
}

export default function ScheduleTable() {
  const { items, loading, updateSchedule, deleteSchedule, setSelectedId, setShowAuditDrawer, operatorName } = useScheduleStore()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRemark, setEditRemark] = useState('')
  const [editStatus, setEditStatus] = useState('')

  const startEdit = useCallback((item: ScheduleItem) => {
    setEditingId(item.id)
    setEditRemark(item.remark)
    setEditStatus(item.status)
  }, [])

  const saveEdit = useCallback(async () => {
    if (editingId === null) return
    await updateSchedule(editingId, { remark: editRemark, status: editStatus })
    setEditingId(null)
  }, [editingId, editRemark, editStatus, updateSchedule])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingId !== null) cancelEdit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingId, cancelEdit])

  const formatDate = (d: string) => {
    if (!d) return '—'
    return d.replace('T', ' ').slice(0, 16)
  }

  const getOperatorInitials = (name: string) => {
    if (!name) return '?'
    return name.slice(0, 1)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">加载中…</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">无匹配记录</p>
          <p className="text-xs mt-1">尝试调整筛选条件</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">备件编号</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">曲目名称</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">文件名</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">版本</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">状态</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">来源</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[200px]">备注</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">修改人/时间</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isEditing = editingId === item.id
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending
            const hasAnomaly = item.status === 'version_conflict' || item.status === 'duplicate' || item.status === 'missing_auth' || !item.track_name || !item.file_name

            return (
              <tr
                key={item.id}
                className={`border-b border-slate-100 transition-colors hover:bg-slate-50/50 ${hasAnomaly ? 'border-l-[3px] ' + statusConfig.border : 'border-l-[3px] border-l-transparent'}`}
              >
                <td className="px-4 py-3 text-slate-400 text-xs">{item.id}</td>
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold text-slate-700">{item.part_no}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={item.track_name ? 'text-slate-700' : 'text-red-400 italic'}>
                    {item.track_name || '(空)'}
                  </span>
                  <AnomalyTag item={item} />
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-xs ${item.file_name ? 'text-slate-500' : 'text-red-400 italic'}`}>
                    {item.file_name || '(空)'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold ${
                    item.version > 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    v{item.version}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <select
                      className="border border-amber-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="pending">待排程</option>
                      <option value="scheduled">已排程</option>
                      <option value="missing_auth">缺授权</option>
                      <option value="version_conflict">版本冲突</option>
                      <option value="duplicate">重复项</option>
                    </select>
                  ) : (
                    <StatusBadge status={item.status} />
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{item.source}</span>
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <textarea
                      className="w-full border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                      rows={2}
                      value={editRemark}
                      onChange={(e) => setEditRemark(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span className="text-xs text-slate-500 leading-relaxed line-clamp-2" title={item.remark}>
                      {item.remark || '—'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {getOperatorInitials(item.modified_by)}
                    </span>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      <div>{item.modified_by || '—'}</div>
                      <div>{formatDate(item.modified_at)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title="保存"
                        >
                          <Save size={13} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors"
                          title="取消"
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(item)}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                          title="编辑"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedId(item.id)
                            setShowAuditDrawer(true)
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                          title="变更历史"
                        >
                          <History size={13} />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`确认删除 ${item.part_no} ${item.track_name}?`)) {
                              await deleteSchedule(item.id)
                            }
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
