import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { RollbackRequest } from '../../shared/types'
import ActionModal from './ActionModal'

interface RollbackModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: RollbackRequest) => Promise<void>
}

export default function RollbackModal({ open, onClose, onConfirm }: RollbackModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await onConfirm({ reason: reason.trim() })
      setReason('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionModal
      open={open}
      onClose={onClose}
      title="回退"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim() || submitting}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '确认回退'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded">
          <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">
            回退操作将撤销最近一次状态变更，此操作不可逆，请确认后再执行。
          </p>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            回退原因 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="请输入回退原因..."
            className="w-full bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500 resize-none"
          />
        </div>
      </div>
    </ActionModal>
  )
}
