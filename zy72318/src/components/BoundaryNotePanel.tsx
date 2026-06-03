import { X, FileText, AlertTriangle, ArrowRight } from 'lucide-react'
import { useVarStore } from '@/store'

export default function BoundaryNotePanel() {
  const { boundaryNotes, boundaryDrawerOpen, setBoundaryDrawerOpen, conflicts, setCurrentStep } = useVarStore()

  return (
    <>
      <div className="space-y-4">
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary font-sans">边界值说明备注</h3>
            <button onClick={() => setBoundaryDrawerOpen(true)} className="btn-ghost text-xs flex items-center gap-1">
              <FileText size={14} />
              展开原文
            </button>
          </div>
          <div className="p-5 space-y-3">
            {boundaryNotes.map((note) => {
              const relatedConflicts = conflicts.filter(
                (c) => c.boundaryNoteId === note.id && c.status === 'pending'
              )
              return (
                <div
                  key={note.id}
                  className={`p-4 rounded-lg border ${
                    relatedConflicts.length > 0
                      ? 'border-accent-red/40 bg-accent-red/5'
                      : 'border-surface-border bg-base-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-text-gold">{note.fieldName}</span>
                    {relatedConflicts.length > 0 && (
                      <span className="badge-red">
                        <AlertTriangle size={10} className="mr-1" />
                        {relatedConflicts.length} 项冲突
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary font-sans leading-relaxed line-clamp-2">
                    {note.originalText}
                  </p>
                  {relatedConflicts.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-text-red font-sans">
                      <span>涉及行：{relatedConflicts.map((c) => c.rowId).join(', ')}</span>
                      <ArrowRight size={12} />
                      <span className="underline cursor-pointer" onClick={() => setCurrentStep('calculation')}>前往复核</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={() => setCurrentStep('calculation')} className="btn-primary flex items-center gap-2">
            <ArrowRight size={16} />
            下一步：更新计算明细
          </button>
        </div>
      </div>

      {boundaryDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBoundaryDrawerOpen(false)} />
          <div className="relative w-[480px] bg-base-800 border-l border-surface-border h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-base-800 px-6 py-4 border-b border-surface-border flex items-center justify-between z-10">
              <h2 className="text-base font-semibold text-text-gold font-sans">边界值说明原文</h2>
              <button
                onClick={() => setBoundaryDrawerOpen(false)}
                className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-3 text-xs text-accent-amber font-sans">
                ⚠ 以下备注原文不得被清洗为整齐数据。备注信息比正式表更重要。
              </div>
              {boundaryNotes.map((note) => {
                const relatedConflicts = conflicts.filter(
                  (c) => c.boundaryNoteId === note.id && c.status === 'pending'
                )
                return (
                  <div
                    key={note.id}
                    className={`p-5 rounded-lg border ${
                      relatedConflicts.length > 0
                        ? 'border-accent-red/40 bg-accent-red/5'
                        : 'border-surface-border bg-base-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-text-gold font-mono">{note.fieldName}</span>
                      {relatedConflicts.length > 0 && (
                        <span className="badge-red">冲突未裁决</span>
                      )}
                    </div>
                    <p className="text-sm text-text-primary font-sans leading-relaxed whitespace-pre-wrap">
                      {note.originalText}
                    </p>
                    {note.relatedRowIds.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-surface-border/50">
                        <span className="text-xs text-text-muted font-sans">关联行：</span>
                        <span className="text-xs text-text-secondary font-mono ml-1">
                          {note.relatedRowIds.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
