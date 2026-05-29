import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Lock, Unlock, Flame, CheckCircle, AlertTriangle, Plus, ArrowRightLeft, X } from 'lucide-react'
import { useStore } from '@/store'
import { Modal, useToast } from '@/components/Dialog'
import type { Batch, QueueEntry, Conflict } from '@/types'
import { BATCH_STATUS_LABELS } from '@/types'

interface BatchDetail {
  batch: Batch
  entries: QueueEntry[]
  conflicts: Conflict[]
}

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>()
  const { show, element: toastEl } = useToast()
  const { works, batches, lockBatch, unlockBatch, fireBatch, completeBatch, enqueue, dequeue, reschedule } = useStore()

  const [detail, setDetail] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null)
  const [addForm, setAddForm] = useState({ work_id: '', position: 0 })
  const [rescheduleForm, setRescheduleForm] = useState({ to_batch_id: '', reason: '', operated_by: '' })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/batches/${id}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(body => {
        if (cancelled) return
        if (!body.success) throw new Error(body.error || '未找到批次')
        const batchData = body.data
        const entries = (batchData.entries ?? []).map((e: any) => ({
          ...e,
          glaze_names: typeof e.glaze_names === 'string' ? e.glaze_names.split(',').filter(Boolean) : (e.glaze_names ?? []),
        }))
        setDetail({ batch: batchData, entries, conflicts: batchData.conflicts ?? [] })
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          show('加载失败', 'error')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [id])

  const batch = detail?.batch
  const entries = detail?.entries ?? []
  const conflicts = detail?.conflicts ?? []
  const pendingWorks = works.filter(w => w.status === 'pending' || w.status === 'rescheduled')

  const refreshDetail = () => {
    if (!id) return
    fetch(`/api/batches/${id}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(body => {
        if (!body.success) return
        const batchData = body.data
        const entries = (batchData.entries ?? []).map((e: any) => ({
          ...e,
          glaze_names: typeof e.glaze_names === 'string' ? e.glaze_names.split(',').filter(Boolean) : (e.glaze_names ?? []),
        }))
        setDetail({ batch: batchData, entries, conflicts: batchData.conflicts ?? [] })
      })
      .catch(() => {})
  }

  const handleAction = async (action: () => Promise<Batch | null>, label: string) => {
    const res = await action()
    if (res) { show(`${label}成功`); refreshDetail() }
    else show(`${label}失败`, 'error')
  }

  const handleEnqueue = async () => {
    if (!addForm.work_id || !id) { show('请选择作品', 'warning'); return }
    const result = await enqueue(addForm.work_id, id, addForm.position || undefined)
    if (result.entry) {
      show(result.conflicts.length > 0 ? `已入队，存在 ${result.conflicts.length} 个冲突` : '已入队', result.conflicts.length > 0 ? 'warning' : 'success')
      setAddOpen(false)
      setAddForm({ work_id: '', position: 0 })
      refreshDetail()
    } else {
      show('入队失败', 'error')
    }
  }

  const handleDequeue = async (entryId: string) => {
    const ok = await dequeue(entryId)
    if (ok) { show('已移除'); refreshDetail() }
    else show('移除失败', 'error')
  }

  const handleReschedule = async () => {
    if (!selectedEntry || !id) return
    const ok = await reschedule({
      work_id: selectedEntry.work_id,
      from_batch_id: id,
      to_batch_id: rescheduleForm.to_batch_id || undefined,
      reason: rescheduleForm.reason,
      operated_by: rescheduleForm.operated_by,
    })
    if (ok) {
      show('已改期')
      setRescheduleOpen(false)
      setRescheduleForm({ to_batch_id: '', reason: '', operated_by: '' })
      refreshDetail()
    } else {
      show('改期失败', 'error')
    }
  }

  if (loading) return <div className="text-center py-12 text-slate2-400">加载中…</div>
  if (!batch) return <div className="text-center py-12 text-slate2-400">批次不存在</div>

  return (
    <div className="space-y-6">
      {toastEl}

      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate2-700">{batch.name}</h1>
            <p className="text-sm text-slate2-400 mt-1">{batch.kiln_name} · {batch.max_width}×{batch.max_height}×{batch.max_depth} cm</p>
          </div>
          <span className={`badge-${batch.status}`}>{BATCH_STATUS_LABELS[batch.status]}</span>
        </div>
        <div className="flex gap-2 mt-4">
          {batch.status === 'open' && (
            <button className="btn-secondary btn-sm flex items-center gap-1" onClick={() => handleAction(() => lockBatch(batch.id), '锁定')}>
              <Lock className="w-3 h-3" /> 锁定
            </button>
          )}
          {batch.status === 'locked' && (
            <>
              <button className="btn-secondary btn-sm flex items-center gap-1" onClick={() => handleAction(() => unlockBatch(batch.id), '解锁')}>
                <Unlock className="w-3 h-3" /> 解锁
              </button>
              <button className="btn-primary btn-sm flex items-center gap-1" onClick={() => handleAction(() => fireBatch(batch.id), '开始烧制')}>
                <Flame className="w-3 h-3" /> 开始烧制
              </button>
            </>
          )}
          {batch.status === 'firing' && (
            <button className="btn-primary btn-sm flex items-center gap-1" onClick={() => handleAction(() => completeBatch(batch.id), '完成')}>
              <CheckCircle className="w-3 h-3" /> 完成
            </button>
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-serif font-semibold text-slate2-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-kiln-400" /> 冲突警告
          </h2>
          {conflicts.map((c, i) => (
            <div key={i} className={`rounded-xl p-4 border ${c.type === 'glaze_conflict' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${c.type === 'glaze_conflict' ? 'text-red-500' : 'text-orange-500'}`} />
                <span className="text-sm font-medium text-slate2-700">{c.message}</span>
              </div>
              {c.details && Object.keys(c.details).length > 0 && (
                <div className="mt-2 text-xs text-slate2-500 space-y-0.5">
                  {Object.entries(c.details).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-clay-100">
          <h2 className="font-serif font-semibold text-slate2-700">排队作品 ({entries.length})</h2>
          {batch.status === 'open' && (
            <button className="btn-primary btn-sm flex items-center gap-1" onClick={() => setAddOpen(true)}>
              <Plus className="w-3 h-3" /> 添加作品
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <div className="py-8 text-center text-slate2-400 text-sm">暂无作品</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-clay-50 text-slate2-500">
                <th className="px-4 py-2 text-left font-medium">序号</th>
                <th className="px-4 py-2 text-left font-medium">作品名称</th>
                <th className="px-4 py-2 text-left font-medium">学员</th>
                <th className="px-4 py-2 text-left font-medium">釉料</th>
                <th className="px-4 py-2 text-left font-medium">尺寸</th>
                {batch.status === 'open' && <th className="px-4 py-2 text-right font-medium">操作</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-t border-clay-50 hover:bg-clay-50/50">
                  <td className="px-4 py-3">{entry.position}</td>
                  <td className="px-4 py-3 font-medium text-slate2-700">{entry.work_name}</td>
                  <td className="px-4 py-3 text-slate2-500">{entry.student_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {(entry.glaze_names ?? []).map((g, gi) => (
                        <span key={gi} className="bg-clay-100 text-clay-600 px-1.5 py-0.5 rounded text-xs">{g}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate2-500">{entry.width}×{entry.height}×{entry.depth}</td>
                  {batch.status === 'open' && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-secondary btn-sm text-xs" onClick={() => { setSelectedEntry(entry); setRescheduleOpen(true) }}>
                          <ArrowRightLeft className="w-3 h-3 inline mr-0.5" /> 改期
                        </button>
                        <button className="btn-danger btn-sm text-xs" onClick={() => handleDequeue(entry.id)}>
                          <X className="w-3 h-3 inline mr-0.5" /> 移除
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="添加作品到批次">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">选择作品</label>
            <select className="select-field" value={addForm.work_id} onChange={e => setAddForm(f => ({ ...f, work_id: e.target.value }))}>
              <option value="">-- 请选择 --</option>
              {pendingWorks.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.student_name ?? '未知'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">位置（留空自动排末尾）</label>
            <input type="number" className="input-field" value={addForm.position || ''} onChange={e => setAddForm(f => ({ ...f, position: +e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>取消</button>
            <button className="btn-primary" onClick={handleEnqueue}>添加</button>
          </div>
        </div>
      </Modal>

      <Modal open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} title="改期">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">目标批次（可选，留空仅移除）</label>
            <select className="select-field" value={rescheduleForm.to_batch_id} onChange={e => setRescheduleForm(f => ({ ...f, to_batch_id: e.target.value }))}>
              <option value="">-- 仅移除 --</option>
              {batches.filter(b => b.id !== id && b.status === 'open').map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">原因</label>
            <textarea className="input-field" rows={3} value={rescheduleForm.reason} onChange={e => setRescheduleForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">操作人</label>
            <input className="input-field" value={rescheduleForm.operated_by} onChange={e => setRescheduleForm(f => ({ ...f, operated_by: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setRescheduleOpen(false)}>取消</button>
            <button className="btn-primary" onClick={handleReschedule}>确认改期</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
