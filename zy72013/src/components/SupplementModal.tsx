import { useState } from 'react'
import type { SupplementRequest } from '../../shared/types'
import ActionModal from './ActionModal'

interface SupplementModalProps {
  open: boolean
  onClose: () => void
  currentRemark: string
  onConfirm: (data: SupplementRequest) => Promise<void>
}

export default function SupplementModal({
  open,
  onClose,
  currentRemark,
  onConfirm,
}: SupplementModalProps) {
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!remark.trim()) return
    setSubmitting(true)
    try {
      await onConfirm({ remark: remark.trim() })
      setRemark('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionModal
      open={open}
      onClose={onClose}
      title="补录备注"
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
            disabled={!remark.trim() || submitting}
            className="px-4 py-2 text-sm font-medium border border-[#2a2a4a] text-gray-200 hover:bg-[#2a2a4a] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '确认补录'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {currentRemark && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">当前备注</label>
            <p className="text-sm text-gray-300 bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-2 max-h-24 overflow-y-auto">
              {currentRemark}
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm text-gray-400 mb-1">补录内容</label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="请输入补录备注内容..."
            className="w-full bg-[#12122a] border border-[#2a2a4a] rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-600 resize-none"
          />
        </div>
      </div>
    </ActionModal>
  )
}
