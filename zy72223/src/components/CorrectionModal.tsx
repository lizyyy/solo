import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { type Entry, useStore } from '@/store'

interface CorrectionModalProps {
  entry: Entry | null
  onClose: () => void
}

export default function CorrectionModal({ entry, onClose }: CorrectionModalProps) {
  const { manualCorrect } = useStore()
  const [amount, setAmount] = useState(entry?.amount?.toString() ?? '')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  if (!entry) return null

  const handleSave = async () => {
    if (!reason.trim()) return
    setSaving(true)
    try {
      await manualCorrect(entry.id, {
        amount: amount ? parseFloat(amount) : undefined,
        note: note || undefined,
        correctionReason: reason,
      })
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
          <h3 className="font-serif font-semibold text-ledger-text">人工修正</h3>
          <button onClick={onClose} className="p-1 rounded-md text-ledger-muted hover:bg-ledger-bg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-ledger-bg rounded-lg p-3 text-sm">
            <p className="text-ledger-text font-medium">{entry.securityName}</p>
            <p className="text-ledger-muted font-mono text-xs mt-1">
              {entry.securityCode} · 当前金额 {entry.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ledger-text">修正金额</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-ledger-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ledger-amber/30 focus:border-ledger-amber"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ledger-text">修正备注</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-ledger-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger-amber/30 focus:border-ledger-amber resize-none"
              placeholder="补充说明..."
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ledger-text">
              修正原因 <span className="text-ledger-red">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-ledger-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger-amber/30 focus:border-ledger-amber resize-none"
              placeholder="必填：说明修正原因..."
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
            onClick={handleSave}
            disabled={!reason.trim() || saving}
            className="flex items-center gap-2 rounded-lg bg-ledger-amber text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-ledger-amber/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '确认修正'}
          </button>
        </div>
      </div>
    </div>
  )
}
