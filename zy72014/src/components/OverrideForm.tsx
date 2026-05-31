import { useState } from 'react'

interface OverrideFormProps {
  onSubmit: (field: string, newValue: string, reason: string) => void
  loading: boolean
}

const FIELDS = [
  { value: 'totalTip', label: '打赏总额' },
  { value: 'refundAmount', label: '退款金额' },
  { value: 'shareRate', label: '分成比例' },
  { value: 'settlementAmount', label: '结算金额' },
]

export default function OverrideForm({ onSubmit, loading }: OverrideFormProps) {
  const [field, setField] = useState('settlementAmount')
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newValue || !reason) return
    onSubmit(field, newValue, reason)
    setNewValue('')
    setReason('')
  }

  return (
    <form onSubmit={handleSubmit} className="border border-stone-200 bg-stone-50 p-4">
      <h4 className="text-sm font-medium text-stone-700 mb-3">改判</h4>
      <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
        <label className="text-xs text-stone-500">字段</label>
        <select
          value={field}
          onChange={e => setField(e.target.value)}
          className="border border-stone-300 px-2 py-1 text-sm bg-white"
        >
          {FIELDS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <label className="text-xs text-stone-500">新值</label>
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="输入新值"
          required
          className="border border-stone-300 px-2 py-1 text-sm bg-white font-mono"
        />

        <label className="text-xs text-stone-500">原因（必填）</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="填写改判原因"
          required
          rows={2}
          className="border border-stone-300 px-2 py-1 text-sm bg-white resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !newValue || !reason}
        className="mt-3 px-4 py-1.5 bg-[#1e3a5f] text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#152d4a]"
      >
        提交改判
      </button>
    </form>
  )
}
