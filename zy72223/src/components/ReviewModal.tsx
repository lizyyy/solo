import { useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import { type Entry, useStore } from '@/store'

interface ReviewModalProps {
  entry: Entry | null
  onClose: () => void
}

export default function ReviewModal({ entry, onClose }: ReviewModalProps) {
  const { reviewEntry } = useStore()
  const [reviewedBy, setReviewedBy] = useState('风控同事')
  const [saving, setSaving] = useState(false)

  if (!entry) return null

  const handleConfirm = async () => {
    if (!reviewedBy.trim()) return
    setSaving(true)
    try {
      await reviewEntry(entry.id, { reviewedBy })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ledger-border">
          <h3 className="font-serif font-semibold text-ledger-text flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            风控复核
          </h3>
          <button onClick={onClose} className="p-1 rounded-md text-ledger-muted hover:bg-ledger-bg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-ledger-red-light/50 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-ledger-muted">证券名称</span>
              <span className="text-ledger-text font-medium">{entry.securityName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ledger-muted">证券代码</span>
              <span className="text-ledger-text font-mono text-xs">{entry.securityCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ledger-muted">金额</span>
              <span className="text-ledger-text font-mono">
                {entry.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ledger-muted">备注</span>
              <span className="text-ledger-text">{entry.note || '—'}</span>
            </div>
            {entry.taxRateNote && (
              <div className="flex justify-between">
                <span className="text-ledger-muted">税费率备注</span>
                <span className="text-ledger-text">{entry.taxRateNote}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ledger-text">
              复核人 <span className="text-ledger-red">*</span>
            </label>
            <input
              type="text"
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              className="w-full rounded-lg border border-ledger-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="输入复核人姓名"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-ledger-border">
          <button
            onClick={onClose}
            className="rounded-lg border border-ledger-border px-4 py-2 text-sm text-ledger-muted hover:bg-ledger-bg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reviewedBy.trim() || saving}
            className="flex items-center gap-2 rounded-lg bg-blue-500 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-4 h-4" />
            {saving ? '确认中...' : '确认复核'}
          </button>
        </div>
      </div>
    </div>
  )
}
