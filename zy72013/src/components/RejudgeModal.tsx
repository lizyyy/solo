import { useState } from 'react'
import { STATUS_LABELS } from '../../shared/types'
import type { RecordStatus, RejudgeRequest } from '../../shared/types'
import ActionModal from './ActionModal'

interface RejudgeModalProps {
  open: boolean
  onClose: () => void
  currentStatus: RecordStatus
  onConfirm: (data: RejudgeRequest) => Promise<void>
}

const STATUS_OPTIONS: RecordStatus[] = ['pending', 'confirmed', 'returned', 'suspended']

export default function RejudgeModal({ open, onClose, currentStatus, onConfirm }: RejudgeModalProps) {
  const [newStatus, setNewStatus] = useState<RecordStatus>('confirmed')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await onConfirm({ new_status: newStatus, reason: reason.trim() })
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
      title="改判"
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
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '确认改判'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">当前状态</label>
          <span className="text-sm text-gray-300">{STATUS_LABELS[currentStatus]}</span>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">改判为</label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as RecordStatus)}
            className="w-full bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-600"
          >
            {STATUS_OPTIONS.filter((s) => s !== currentStatus).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            改判原因 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="请输入改判原因..."
            className="w-full bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-600 resize-none"
          />
        </div>
      </div>
    </ActionModal>
  )
}
