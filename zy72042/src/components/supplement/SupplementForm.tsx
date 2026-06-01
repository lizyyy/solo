import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { useSupplementStore } from '@/stores/supplementStore'

interface SupplementFormProps {
  sessionId: string
  onAdded: () => void
}

const FIELD_OPTIONS = [
  { value: 'score', label: '得分' },
  { value: 'risk', label: '风险' },
  { value: 'holdings', label: '持仓' },
  { value: 'failReason', label: '失败原因' },
] as const

export default function SupplementForm({ sessionId, onAdded }: SupplementFormProps) {
  const addSupplement = useSupplementStore((s) => s.addSupplement)
  const [note, setNote] = useState('')
  const [field, setField] = useState<string>('score')
  const [valueBefore, setValueBefore] = useState('')
  const [valueAfter, setValueAfter] = useState('')

  const handleSubmit = () => {
    if (!field || !valueBefore || !valueAfter) return

    addSupplement(sessionId, {
      id: `sup-${Date.now()}`,
      sessionId,
      note,
      field,
      valueBefore,
      valueAfter,
      supplementedAt: Date.now(),
    })

    setNote('')
    setValueBefore('')
    setValueAfter('')
    onAdded()
  }

  return (
    <div className="card-cafe flex flex-col gap-3">
      <div className="flex items-center gap-2 text-cafe-brown font-medium">
        <FileText className="w-4 h-4" />
        <span>补录记录</span>
      </div>

      <textarea
        className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-sm text-cafe-brown placeholder:text-cafe-brown/40 focus:outline-none focus:ring-2 focus:ring-cafe-latte resize-none"
        rows={2}
        placeholder="输入补录备注..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <select
        className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-sm text-cafe-brown focus:outline-none focus:ring-2 focus:ring-cafe-latte"
        value={field}
        onChange={(e) => setField(e.target.value)}
      >
        {FIELD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <input
          className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-sm text-cafe-brown placeholder:text-cafe-brown/40 focus:outline-none focus:ring-2 focus:ring-cafe-latte"
          placeholder="修改前值"
          value={valueBefore}
          onChange={(e) => setValueBefore(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-sm text-cafe-brown placeholder:text-cafe-brown/40 focus:outline-none focus:ring-2 focus:ring-cafe-latte"
          placeholder="修改后值"
          value={valueAfter}
          onChange={(e) => setValueAfter(e.target.value)}
        />
      </div>

      <button
        className="flex items-center justify-center gap-1.5 rounded-lg bg-cafe-brown px-4 py-2 text-sm font-medium text-white hover:bg-cafe-brown/90 transition-colors disabled:opacity-40"
        onClick={handleSubmit}
        disabled={!field || !valueBefore || !valueAfter}
      >
        <Plus className="w-4 h-4" />
        添加补录
      </button>
    </div>
  )
}
