import { useState } from 'react'

interface RollbackFormProps {
  onSubmit: (reason: string) => void
  loading: boolean
}

export default function RollbackForm({ onSubmit, loading }: RollbackFormProps) {
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return
    onSubmit(reason)
    setReason('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-1.5 border border-orange-400 text-orange-700 text-sm hover:bg-orange-50"
      >
        回退
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-orange-300 bg-orange-50 p-4">
      <h4 className="text-sm font-medium text-orange-800 mb-3">回退操作</h4>
      <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
        <label className="text-xs text-orange-600">原因（必填）</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="填写回退原因"
          required
          rows={2}
          className="border border-orange-300 px-2 py-1 text-sm bg-white resize-none"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={loading || !reason}
          className="px-4 py-1.5 bg-orange-600 text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-700"
        >
          确认回退
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-1.5 border border-stone-300 text-stone-600 text-sm hover:bg-stone-50"
        >
          取消
        </button>
      </div>
    </form>
  )
}
