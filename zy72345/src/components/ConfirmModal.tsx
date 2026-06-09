interface ConfirmModalProps {
  isOpen: boolean
  title: string
  description: string
  preview?:
    | { from: string; to: string }
    | Array<{ field?: string; from?: string; to?: string; willBecome?: string; currentValue?: string }>
  warn?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  description,
  preview,
  warn,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  const renderPreview = () => {
    if (!preview) return null
    const arr = Array.isArray(preview)
      ? preview
      : [{ from: preview.from, to: preview.to }]
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 text-sm mb-4">
        <p className="text-slate-500 text-xs mb-2">变更预览</p>
        <div className="space-y-2">
          {arr.map((p, i) => {
            const f = p.from ?? p.currentValue ?? ''
            const t = p.to ?? p.willBecome ?? ''
            const label = p.field
            return (
              <div key={i} className="space-y-1">
                {label && <p className="text-slate-500 text-xs">{label}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="line-through text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">{f}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{t}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100 mb-2" style={{ fontFamily: 'var(--font-title)' }}>{title}</h3>
        <p className="text-slate-400 text-sm mb-4">{description}</p>
        {renderPreview()}
        {warn && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm mb-4 text-amber-400">
            ⚠ {warn}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">{cancelText}</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-amber-500 text-slate-900 rounded-lg font-medium hover:bg-amber-400 transition-colors">{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
