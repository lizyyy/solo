import { useState } from 'react'
import { useCraneStore } from '@/store'
import { MessageSquarePlus, ArrowRight } from 'lucide-react'

export default function SupplementForm() {
  const records = useCraneStore(s => s.records)
  const supplements = useCraneStore(s => s.supplements)
  const addSupplement = useCraneStore(s => s.addSupplement)

  const [selectedId, setSelectedId] = useState('')
  const [note, setNote] = useState('')
  const [lastSupplement, setLastSupplement] = useState<{
    note: string
    deltaExplanation: string
  } | null>(null)

  function handleAdd() {
    if (!selectedId || !note.trim()) return
    addSupplement(selectedId, note.trim())
    const rec = supplements.find(s => s.recordId === selectedId)
    setLastSupplement({
      note: note.trim(),
      deltaExplanation: rec?.deltaExplanation ?? '补录已记录',
    })
    setNote('')
    setTimeout(() => setLastSupplement(null), 5000)
  }

  return (
    <div className="harbor-panel p-4">
      <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2 mb-3">
        <MessageSquarePlus className="w-4 h-4" />
        备注补录
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">选择记录</label>
          <select
            className="harbor-input w-full"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            <option value="">-- 请选择 --</option>
            {records.map(r => (
              <option key={r.id} value={r.id}>
                {r.id.slice(0, 16)} | {r.swingAngle}{r.swingAngleUnit} | {r.status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">补录备注</label>
          <textarea
            className="harbor-input w-full h-20 resize-none"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="输入补充说明，如：现场确认方向符号无误"
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={!selectedId || !note.trim()}
          className="harbor-btn w-full text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          补录并计算差异
        </button>

        {lastSupplement && (
          <div className="bg-blue-400/5 border border-blue-400/20 rounded p-3 text-sm">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <ArrowRight className="w-4 h-4" />
              <span className="font-medium">补录差异说明</span>
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">备注:</span> {lastSupplement.note}
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">差异:</span> {lastSupplement.deltaExplanation}
            </div>
          </div>
        )}
      </div>

      {supplements.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs text-gray-500">历史补录</div>
          {supplements.map(sup => (
            <div key={sup.id} className="text-xs bg-harbor-bg border border-harbor-border/50 rounded p-2">
              <div className="flex items-center gap-2 text-gray-400">
                <span className="font-mono">{sup.recordId.slice(0, 12)}</span>
                <span>{new Date(sup.addedAt).toLocaleString('zh-CN')}</span>
              </div>
              <div className="text-gray-300 mt-0.5">{sup.note}</div>
              <div className="text-blue-400 mt-0.5">{sup.deltaExplanation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
