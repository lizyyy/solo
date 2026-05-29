import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { useCallbackStore } from '@/store/useCallbackStore'
import StatsCard from '@/components/StatsCard'
import StatusBadge from '@/components/StatusBadge'

export default function Report() {
  const {
    auditReport,
    fetchAuditReport,
    callbacks,
    fetchCallbacks,
    exportData,
    updateAnnotation,
  } = useCallbackStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')

  useEffect(() => {
    fetchAuditReport()
    fetchCallbacks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBlur = async (id: string) => {
    if (editNote.trim()) {
      await updateAnnotation(id, editNote.trim())
    }
    setEditingId(null)
    setEditNote('')
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">审计报告</h2>

      {auditReport && (
        <div className="grid grid-cols-4 gap-4">
          <StatsCard
            title="总回调量"
            value={auditReport.total_callbacks}
            icon={<FileText size={20} />}
            color="amber"
          />
          <StatsCard
            title="签名过期"
            value={auditReport.signature_expired}
            icon={<FileText size={20} />}
            color="red"
          />
          <StatsCard
            title="待确认"
            value={auditReport.pending_confirmations}
            icon={<FileText size={20} />}
            color="amber"
          />
          <StatsCard
            title="重放失败"
            value={auditReport.replay_failed}
            icon={<FileText size={20} />}
            color="red"
          />
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-bg-tertiary)] overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                <th className="px-3 py-2.5 text-left font-medium">ID</th>
                <th className="px-3 py-2.5 text-left font-medium">订单号</th>
                <th className="px-3 py-2.5 text-left font-medium">签名状态</th>
                <th className="px-3 py-2.5 text-left font-medium">处理结果</th>
                <th className="px-3 py-2.5 text-left font-medium">确认状态</th>
                <th className="px-3 py-2.5 text-left font-medium">备注</th>
                <th className="px-3 py-2.5 text-left font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {callbacks.map((cb) => (
                <tr
                  key={cb.id}
                  className="border-t border-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-xs">{cb.id}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{cb.order_id}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={cb.signature_status} type="signature" /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={cb.processing_result} type="processing" /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={cb.confirm_status} type="confirm" /></td>
                  <td className="px-3 py-2.5">
                    {editingId === cb.id ? (
                      <textarea
                        autoFocus
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        onBlur={() => handleBlur(cb.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleBlur(cb.id)
                          }
                        }}
                        className="w-full min-h-[32px] rounded border border-[var(--color-amber)] bg-[var(--color-bg-primary)] px-2 py-1 font-mono text-xs text-[var(--color-text-primary)] resize-none"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingId(cb.id)
                          setEditNote(cb.confirm_note || '')
                        }}
                        className="cursor-pointer font-mono text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        {cb.confirm_note || '点击添加备注'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-text-secondary)]">
                    {new Date(cb.timestamp).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => exportData('csv')}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--color-emerald)] text-sm font-medium text-[var(--color-bg-primary)] hover:opacity-90 transition-colors"
        >
          <Download size={14} />
          导出 CSV
        </button>
        <button
          onClick={() => exportData('json')}
          className="flex items-center gap-2 h-9 px-4 rounded-lg border border-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)] transition-colors"
        >
          <Download size={14} />
          导出 JSON
        </button>
      </div>
    </div>
  )
}
