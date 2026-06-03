import { useState } from 'react'
import { X, Save, Eye } from 'lucide-react'
import { useStore, type Entry } from '@/store'

interface NoteEditorProps {
  entry: Entry | null
  onClose: () => void
}

export default function NoteEditor({ entry, onClose }: NoteEditorProps) {
  const { supplementNote, entries } = useStore()
  const [taxRate, setTaxRate] = useState('')
  const [taxRateNote, setTaxRateNote] = useState('')
  const [operator, setOperator] = useState('基金会计林姐')
  const [saving, setSaving] = useState(false)

  if (!entry) return null

  const pendingCount = entries.filter(
    (e) => e.status === 'pending_review' && e.taxRate == null
  ).length

  const handleSave = async () => {
    if (!taxRate) return
    setSaving(true)
    try {
      await supplementNote(entry.id, {
        taxRate: parseFloat(taxRate),
        taxRateNote,
        operator,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-96 bg-white shadow-xl border-l border-ledger-border flex flex-col">
        <div className="h-14 flex items-center justify-between px-5 border-b border-ledger-border">
          <h3 className="font-serif font-semibold text-ledger-text">补录税费率备注</h3>
          <button onClick={onClose} className="p-1 rounded-md text-ledger-muted hover:bg-ledger-bg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="bg-ledger-amber-light/50 rounded-lg p-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-ledger-amber shrink-0" />
            <span className="text-sm text-ledger-amber">
              当前有 <strong>{pendingCount}</strong> 条待补录条目
            </span>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ledger-text">当前条目</label>
            <div className="bg-ledger-bg rounded-lg p-3 text-sm">
              <p className="text-ledger-text font-medium">{entry.securityName}</p>
              <p className="text-ledger-muted font-mono text-xs mt-1">
                {entry.securityCode} · 金额 {entry.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ledger-text">
              税费率 <span className="text-ledger-red">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full rounded-lg border border-ledger-border px-3 py-2 pr-8 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ledger-amber/30 focus:border-ledger-amber"
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ledger-muted text-sm">%</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ledger-text">备注说明</label>
            <textarea
              value={taxRateNote}
              onChange={(e) => setTaxRateNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-ledger-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger-amber/30 focus:border-ledger-amber resize-none"
              placeholder="输入税费率备注说明..."
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ledger-text">操作人</label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full rounded-lg border border-ledger-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ledger-amber/30 focus:border-ledger-amber"
            />
          </div>
        </div>

        <div className="p-5 border-t border-ledger-border">
          <button
            onClick={handleSave}
            disabled={!taxRate || saving}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-ledger-amber text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-ledger-amber/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存备注'}
          </button>
        </div>
      </div>
    </div>
  )
}
