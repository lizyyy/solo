import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { formatTimestamp, statusLabel, sourceTypeLabel } from '@/utils/helpers'
import { CheckCircle2, X, MessageSquare } from 'lucide-react'

interface Props {
  recordId: string | null
  onClose: () => void
}

export default function ReviewPanel({ recordId, onClose }: Props) {
  const records = useStore((s) => s.records)
  const reviewRecord = useStore((s) => s.reviewRecord)
  const [note, setNote] = useState('')

  const record = records.find((r) => r.id === recordId)
  if (!record) return null

  const handleReview = () => {
    if (!note.trim()) return
    reviewRecord(record.id, note)
    setNote('')
    onClose()
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-slate-700/50 bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-4">
        <h3 className="text-sm font-medium text-slate-200">人工确认</h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-slate-500">记录ID</span>
            <span className="font-mono text-xs text-slate-300">{record.id.slice(-8)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">时间：</span>
              <span className="text-slate-300">
                {formatTimestamp(record.timestamp)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">状态：</span>
              <span className="text-yellow-400">
                {statusLabel(record.status)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">力：</span>
              <span className="text-slate-300">
                {record.force.toFixed(1)} {record.forceUnit}
              </span>
            </div>
            <div>
              <span className="text-slate-500">位移：</span>
              <span className="text-slate-300">
                {record.displacement.toFixed(1)} {record.displacementUnit}
              </span>
            </div>
            <div>
              <span className="text-slate-500">来源：</span>
              <span className="text-slate-300">
                {sourceTypeLabel(record.source.type)} - {record.source.reference}
              </span>
            </div>
            <div>
              <span className="text-slate-500">方向：</span>
              <span className="text-slate-300">{record.direction}</span>
            </div>
          </div>
        </div>

        {record.amendedFrom && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300">
            旧口径说明：{record.amendedFrom}
          </div>
        )}

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <MessageSquare className="h-3 w-3" />
            确认意见（必填）
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="请说明确认理由，如：已核对现场照片IMG_XXX，该值为真实读数"
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleReview}
          disabled={!note.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" />
          确认通过
        </button>
      </div>
    </div>
  )
}
