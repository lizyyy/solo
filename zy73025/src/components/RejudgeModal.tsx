import { useState } from 'react'
import { X, Pencil, Check } from 'lucide-react'
import type { Conclusion } from '@shared/types'
import StatusBadge from './StatusBadge'
import { cn } from '@/lib/utils'

interface SupplementOption {
  id: string
  label: string
}

interface RejudgeModalProps {
  open: boolean
  originalConclusion: Conclusion
  supplements?: SupplementOption[]
  onClose: () => void
  onConfirm: (payload: { conclusion: Conclusion; reason: string; supplementIds: string[] }) => void
}

const CONCLUSION_OPTIONS: Array<{ value: Conclusion; label: string; desc: string }> = [
  { value: 'normal', label: '正常', desc: '各项指标符合标准' },
  { value: 'observe', label: '需观察', desc: '存在边界值，建议持续观察' },
  { value: 'abnormal', label: '异常', desc: '指标明显异常' },
]

const CONCLUSION_LABEL: Record<Conclusion, string> = {
  normal: '正常',
  observe: '需观察',
  abnormal: '异常',
}

export default function RejudgeModal({
  open,
  originalConclusion,
  supplements = [],
  onClose,
  onConfirm,
}: RejudgeModalProps) {
  const [conclusion, setConclusion] = useState<Conclusion>(originalConclusion)
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  if (!open) return null

  const reasonValid = reason.trim().length >= 10
  const canSubmit = reasonValid

  const toggleSupplement = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const submit = () => {
    if (!canSubmit) return
    onConfirm({ conclusion, reason: reason.trim(), supplementIds: selected })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Pencil className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">结论改判</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              原结论
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <StatusBadge conclusion={originalConclusion} />
              <span className="text-sm font-medium text-slate-700">
                {CONCLUSION_LABEL[originalConclusion]}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">选择新结论</label>
            <div className="space-y-2">
              {CONCLUSION_OPTIONS.map((opt) => {
                const active = conclusion === opt.value
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all',
                      active
                        ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <input
                      type="radio"
                      name="conclusion"
                      checked={active}
                      onChange={() => setConclusion(opt.value)}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>改判原因</span>
              <span
                className={cn(
                  'text-[10px] font-medium',
                  reasonValid ? 'text-emerald-600' : 'text-rose-500',
                )}
              >
                {reason.trim().length}/10
              </span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="请详细说明改判原因（至少 10 个字）..."
              className={cn(
                'w-full resize-none rounded-xl border bg-white p-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2',
                reasonValid
                  ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
                  : 'border-slate-200 focus:border-rose-300 focus:ring-rose-100',
              )}
            />
            {!reasonValid && reason.trim().length > 0 && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-500">
                原因需至少 10 个字
              </p>
            )}
          </div>

          {supplements.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                关联补录材料（可选）
              </label>
              <div className="space-y-1.5 rounded-xl border border-slate-200 p-2">
                {supplements.map((s) => {
                  const checked = selected.includes(s.id)
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
                        checked ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSupplement(s.id)}
                        className="accent-emerald-600"
                      />
                      {s.label}
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-white hover:ring-1 hover:ring-slate-200"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-colors',
              canSubmit
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'cursor-not-allowed bg-slate-200 text-slate-400',
            )}
          >
            <Check className="h-3.5 w-3.5" />
            确认改判<span className="text-rose-200">*</span>
          </button>
        </div>
      </div>
    </div>
  )
}
