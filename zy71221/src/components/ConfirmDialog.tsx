import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { AlertTriangle, RotateCcw, X } from 'lucide-react'

export default function ConfirmDialog() {
  const { confirmDialog, closeConfirmDialog, returnReservation, cancelReservation } = useStore()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!confirmDialog.open || !confirmDialog.reservation) return null

  const r = confirmDialog.reservation
  const isReturn = confirmDialog.type === 'return'

  const handleConfirm = async () => {
    setSubmitting(true)
    setError('')
    let ok = false
    if (isReturn) {
      ok = await returnReservation(r.id)
    } else {
      if (!reason.trim()) {
        setError('请输入撤单原因')
        setSubmitting(false)
        return
      }
      ok = await cancelReservation(r.id, reason.trim())
    }
    setSubmitting(false)
    if (ok) {
      setReason('')
      closeConfirmDialog()
    }
  }

  const handleClose = () => {
    setReason('')
    setError('')
    closeConfirmDialog()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 overlay-enter" onClick={handleClose} />
      <div className="relative bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={handleClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          {isReturn ? (
            <RotateCcw className="w-6 h-6 text-blue-400" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          )}
          <h3 className="text-lg font-semibold text-slate-100">
            {isReturn ? '确认归还' : '确认撤单'}
          </h3>
        </div>

        <p className="text-slate-300 mb-3 text-sm">
          {isReturn
            ? `确认归还预约单 #${r.id}？`
            : `确认撤单预约单 #${r.id}？`}
        </p>

        <div className="bg-slate-900/60 rounded-lg p-3 mb-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">客户</span>
            <span className="text-slate-200 font-mono">{r.client_name} ({r.client_account})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">证券</span>
            <span className="text-slate-200 font-mono">{r.security_name} ({r.security_code})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">数量</span>
            <span className="text-slate-200 font-mono">{r.quantity?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">到期日期</span>
            <span className="text-slate-200 font-mono">{r.due_date}</span>
          </div>
        </div>

        <p className="text-xs text-amber-400 mb-3">
          {isReturn
            ? '归还后锁定库存将被释放'
            : '撤单后锁定库存将即时回补'}
        </p>

        {!isReturn && (
          <div className="mb-3">
            <label className="block text-sm text-slate-400 mb-1">撤单原因</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field w-full h-20 resize-none"
              placeholder="请输入撤单原因..."
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={handleClose} className="btn-secondary" disabled={submitting}>
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={isReturn ? 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed' : 'btn-danger'}
          >
            {submitting ? '处理中...' : isReturn ? '确认归还' : '确认撤单'}
          </button>
        </div>
      </div>
    </div>
  )
}
