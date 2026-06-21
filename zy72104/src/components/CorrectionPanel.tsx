import { useState } from 'react'
import { useStore } from '@/store'
import type { ManualCorrection } from '@/types'
import { Plus, Edit3, ChevronDown, ChevronUp } from 'lucide-react'

export default function CorrectionPanel() {
  const batchId = useStore((s) => s.currentBatchId)
  const batch = useStore((s) => s.batches.find((b) => b.id === s.currentBatchId))
  const addCorrection = useStore((s) => s.addCorrection)
  const [expanded, setExpanded] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ fieldName: '', originalValue: '', originalUnit: '', correctedValue: '', correctedUnit: '', reason: '' })

  if (!batchId || !batch) return null

  const corrections = batch.corrections

  const handleAdd = () => {
    if (!form.fieldName || !form.correctedValue) return
    const c: ManualCorrection = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fieldName: form.fieldName,
      originalValue: Number(form.originalValue) || 0,
      originalUnit: form.originalUnit,
      correctedValue: Number(form.correctedValue),
      correctedUnit: form.correctedUnit,
      reason: form.reason,
      correctionTime: new Date().toISOString(),
    }
    addCorrection(batchId, c)
    setForm({ fieldName: '', originalValue: '', originalUnit: '', correctedValue: '', correctedUnit: '', reason: '' })
    setShowForm(false)
  }

  return (
    <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-[#a8d8ea] hover:bg-[#0f3460]/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold text-sm tracking-wide flex items-center gap-2">
          <Edit3 size={14} /> 人工修正（保留原始值）
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {corrections.length > 0 && (
            <div className="space-y-2 mb-3">
              {corrections.map((c) => (
                <div key={c.id} className="bg-[#1a1a2e] rounded border border-[#0f3460]/30 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#a8d8ea] font-medium">{c.fieldName}</span>
                    <span className="text-[#e94560]/80 line-through font-mono">{c.originalValue} {c.originalUnit}</span>
                    <span className="text-[#a8d8ea]/40">→</span>
                    <span className="text-[#16c79a] font-mono">{c.correctedValue} {c.correctedUnit}</span>
                  </div>
                  {c.reason && <p className="text-[11px] text-[#a8d8ea]/50 mt-1">修正原因：{c.reason}</p>}
                  <div className="text-[10px] text-[#a8d8ea]/40 mt-1">{new Date(c.correctionTime).toLocaleString('zh-CN')}</div>
                </div>
              ))}
            </div>
          )}
          {showForm ? (
            <div className="bg-[#1a1a2e] rounded border border-[#0f3460]/40 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="bg-[#16213e] border border-[#0f3460]/50 rounded px-2 py-1 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#a8d8ea]/50"
                  placeholder="字段名"
                  value={form.fieldName}
                  onChange={(e) => setForm({ ...form, fieldName: e.target.value })}
                />
                <div className="flex gap-1">
                  <input
                    className="bg-[#16213e] border border-[#0f3460]/50 rounded px-2 py-1 text-xs text-[#e2e8f0] font-mono flex-1 focus:outline-none focus:border-[#a8d8ea]/50"
                    placeholder="原始值"
                    type="number"
                    value={form.originalValue}
                    onChange={(e) => setForm({ ...form, originalValue: e.target.value })}
                  />
                  <input
                    className="bg-[#16213e] border border-[#0f3460]/50 rounded px-2 py-1 text-xs text-[#e2e8f0] w-16 focus:outline-none focus:border-[#a8d8ea]/50"
                    placeholder="单位"
                    value={form.originalUnit}
                    onChange={(e) => setForm({ ...form, originalUnit: e.target.value })}
                  />
                </div>
                <div className="flex gap-1">
                  <input
                    className="bg-[#16213e] border border-[#0f3460]/50 rounded px-2 py-1 text-xs text-[#e2e8f0] font-mono flex-1 focus:outline-none focus:border-[#a8d8ea]/50"
                    placeholder="修正值"
                    type="number"
                    value={form.correctedValue}
                    onChange={(e) => setForm({ ...form, correctedValue: e.target.value })}
                  />
                  <input
                    className="bg-[#16213e] border border-[#0f3460]/50 rounded px-2 py-1 text-xs text-[#e2e8f0] w-16 focus:outline-none focus:border-[#a8d8ea]/50"
                    placeholder="单位"
                    value={form.correctedUnit}
                    onChange={(e) => setForm({ ...form, correctedUnit: e.target.value })}
                  />
                </div>
                <input
                  className="bg-[#16213e] border border-[#0f3460]/50 rounded px-2 py-1 text-xs text-[#e2e8f0] col-span-2 focus:outline-none focus:border-[#a8d8ea]/50"
                  placeholder="修正原因（必填）"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1 rounded text-xs text-[#a8d8ea]/60 hover:text-[#a8d8ea]"
                >取消</button>
                <button
                  onClick={handleAdd}
                  className="px-3 py-1 rounded bg-[#0f3460] text-xs text-[#a8d8ea] hover:bg-[#0f3460]/80"
                >确认修正</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-xs text-[#a8d8ea] hover:text-[#16c79a] transition-colors"
            >
              <Plus size={14} /> 添加修正
            </button>
          )}
        </div>
      )}
    </div>
  )
}
