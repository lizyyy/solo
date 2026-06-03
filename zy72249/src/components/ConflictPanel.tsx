import { useState } from 'react'
import { X, Camera, FileText, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Discrepancy } from '@/lib/api'
import { useStore } from '@/store'

interface ConflictPanelProps {
  discrepancy: Discrepancy
  onClose: () => void
}

export default function ConflictPanel({ discrepancy, onClose }: ConflictPanelProps) {
  const resolveConflict = useStore(s => s.resolveConflict)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const evidence = discrepancy.evidence || {}
  const confirmData = (evidence.confirmationData || {}) as Record<string, unknown>
  const remarkData = (evidence.taxRemarkData || {}) as Record<string, unknown>

  const handleResolve = async (decision: string) => {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await resolveConflict(discrepancy.id, {
        decidedBy: 'fund_accountant',
        decision,
        reason: reason.trim(),
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex w-[640px] flex-col bg-white shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">冲突裁决</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-1 gap-4 p-6">
          <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <Camera className="h-4 w-4" />
              除权日截图数据
            </div>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">业务号</dt><dd className="font-mono text-gray-900">{String(confirmData.businessNo || '-')}</dd></div>
              <div><dt className="text-gray-500">除权日</dt><dd className="font-mono text-gray-900">{String(confirmData.exDividendDate || '-')}</dd></div>
              <div><dt className="text-gray-500">来源</dt><dd className="text-gray-900">{String(confirmData.source || '-')}</dd></div>
            </dl>
          </div>
          <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <FileText className="h-4 w-4" />
              税费率备注数据
            </div>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-gray-500">业务号</dt><dd className="font-mono text-gray-900">{String(remarkData.businessNo || '-')}</dd></div>
              <div><dt className="text-gray-500">除权日</dt><dd className="font-mono text-gray-900">{String(remarkData.exDividendDate || '-')}</dd></div>
              <div><dt className="text-gray-500">口径</dt><dd className="text-gray-900">{String(remarkData.caliberType === 'old' ? '旧口径' : remarkData.caliberType === 'new' ? '新口径' : '-')}</dd></div>
              <div><dt className="text-gray-500">来源</dt><dd className="text-gray-900">{String(remarkData.source || '-')}</dd></div>
            </dl>
          </div>
        </div>

        <div className="border-t px-6 py-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            裁决理由 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="请输入裁决理由，所有冲突必须人工确认..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-amber)] focus:outline-none focus:ring-1 focus:ring-[var(--color-amber)]"
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleResolve('confirm_screenshot')}
              disabled={!reason.trim() || submitting}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors',
                reason.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-blue-300'
              )}
            >
              <Camera className="h-4 w-4" />确认截图数据
            </button>
            <button
              onClick={() => handleResolve('confirm_remark')}
              disabled={!reason.trim() || submitting}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors',
                reason.trim() ? 'bg-[var(--color-amber)] hover:bg-[var(--color-amber-dark)]' : 'cursor-not-allowed bg-amber-300'
              )}
            >
              <FileText className="h-4 w-4" />确认备注数据
            </button>
            <button
              onClick={() => handleResolve('reject_both')}
              disabled={!reason.trim() || submitting}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors',
                reason.trim() ? 'bg-red-600 hover:bg-red-700' : 'cursor-not-allowed bg-red-300'
              )}
            >
              <Ban className="h-4 w-4" />驳回两者
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
