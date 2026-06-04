import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Eye, MessageSquare, Send, Clock, Shield } from 'lucide-react'
import { useStore, type BoundarySample } from '@/store'

const typeLabels: Record<string, string> = {
  negative_as_missing: '负数标缺失',
  value_out_of_range: '值超出范围',
  duplicate_detected: '重复检测',
}

const typeColors: Record<string, string> = {
  negative_as_missing: 'bg-rose-500/10 text-rose-400',
  value_out_of_range: 'bg-amber-500/10 text-amber-400',
  duplicate_detected: 'bg-purple-500/10 text-purple-400',
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待处理', color: 'bg-amber-500/10 text-amber-500', icon: AlertTriangle },
  confirmed: { label: '已确认', color: 'bg-emerald-500/10 text-emerald-500', icon: CheckCircle },
  ignored: { label: '已忽略', color: 'bg-slate-600/30 text-slate-400', icon: Eye },
}

function ConfirmModal({ open, onClose, onConfirm, sample }: { open: boolean; onClose: () => void; onConfirm: () => void; sample: BoundarySample | null }) {
  if (!open || !sample) return null
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100 mb-2" style={{ fontFamily: 'var(--font-title)' }}>确认操作</h3>
        <p className="text-slate-400 text-sm mb-4">
          确定要将此边界样本标记为已确认/已忽略吗？此操作需教研负责人权限。
        </p>
        <div className="bg-slate-800/30 rounded-lg p-3 text-sm mb-4">
          <p className="text-slate-300">{sample.description}</p>
          <p className="text-slate-500 text-xs mt-1">检测时间: {new Date(sample.detectedAt).toLocaleString('zh-CN')}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">取消</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-amber-500 text-slate-900 rounded-lg font-medium hover:bg-amber-400 transition-colors">确认</button>
        </div>
      </div>
    </div>
  )
}

function BoundaryCard({ sample, userRole }: { sample: BoundarySample; userRole: string }) {
  const { updateBoundaryStatus, addReviewComment } = useStore()
  const [comment, setComment] = useState('')
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; status: 'confirmed' | 'ignored'; sample: BoundarySample | null }>({ open: false, status: 'confirmed', sample: null })
  const isPending = sample.status === 'pending'
  const statusCfg = statusConfig[sample.status]

  const handleStatusChange = (status: 'confirmed' | 'ignored') => {
    if (userRole !== '教研负责人') return
    setConfirmModal({ open: true, status, sample })
  }

  const handleConfirm = async () => {
    if (!confirmModal.sample) return
    try {
      await updateBoundaryStatus(confirmModal.sample.id, confirmModal.status)
      setConfirmModal({ open: false, status: 'confirmed', sample: null })
    } catch {}
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    await addReviewComment(sample.id, comment.trim())
    setComment('')
  }

  return (
    <>
      <div className={`bg-slate-800/50 backdrop-blur rounded-xl border ${isPending ? 'border-amber-500/30 animate-pulse-amber' : 'border-slate-700/50'} p-5 space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[sample.type] || 'bg-slate-600/30 text-slate-400'}`}>
              {typeLabels[sample.type] || sample.type}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color} flex items-center gap-1`}>
              <statusCfg.icon size={12} />
              {statusCfg.label}
            </span>
          </div>
          {userRole === '教研负责人' && isPending && (
            <div className="flex gap-1">
              <button onClick={() => handleStatusChange('confirmed')} className="px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors">确认</button>
              <button onClick={() => handleStatusChange('ignored')} className="px-2.5 py-1 text-xs bg-slate-600/30 text-slate-400 rounded hover:bg-slate-600/50 transition-colors">忽略</button>
            </div>
          )}
        </div>

        <p className="text-slate-300 text-sm">{sample.description}</p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Clock size={12} /> {new Date(sample.detectedAt).toLocaleString('zh-CN')}</span>
          {sample.confirmedBy && <span className="flex items-center gap-1"><Shield size={12} /> {sample.confirmedBy}</span>}
        </div>

        {sample.reviewComments.length > 0 && (
          <div className="border-t border-slate-700/50 pt-3 space-y-2">
            <p className="text-xs text-slate-500 flex items-center gap-1"><MessageSquare size={12} /> 复核意见</p>
            {sample.reviewComments.map(c => (
              <div key={c.id} className="bg-slate-800/30 rounded-lg p-2 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-300 text-xs">{c.author}</span>
                  <span className="text-slate-500 text-xs">{c.authorRole}</span>
                  <span className="text-slate-600 text-xs">{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <p className="text-slate-400 text-xs">{c.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="添加复核意见..."
            className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
            onKeyDown={e => { if (e.key === 'Enter') handleAddComment() }}
          />
          <button onClick={handleAddComment} className="px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors">
            <Send size={14} />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={handleConfirm}
        sample={confirmModal.sample}
      />
    </>
  )
}

const filterTabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'confirmed', label: '已确认' },
  { key: 'ignored', label: '已忽略' },
]

export default function Boundary() {
  const { boundarySamples, userRole, fetchBoundarySamples } = useStore()
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchBoundarySamples()
  }, [])

  const handleFilter = (key: string) => {
    setFilter(key)
    fetchBoundarySamples(key === 'all' ? undefined : key)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>边界样本报告</h2>

      <div className="flex gap-6">
        <div className="w-48 shrink-0 space-y-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleFilter(tab.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${filter === tab.key ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4">
          {boundarySamples.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center text-slate-500">
              暂无边界样本
            </div>
          ) : (
            boundarySamples.map(sample => (
              <BoundaryCard key={sample.id} sample={sample} userRole={userRole} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
