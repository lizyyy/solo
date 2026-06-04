import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (comment: string) => Promise<void>
  action: 'approve' | 'rollback'
  sensorCode?: string
}

export default function ReviewModal({ isOpen, onClose, onConfirm, action, sensorCode }: ReviewModalProps) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!comment.trim()) {
      setError('请填写复核意见')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onConfirm(comment.trim())
      setComment('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const isApprove = action === 'approve'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isApprove ? '通过复核' : '回滚变更'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className={clsx(
            'flex items-start gap-3 p-4 rounded-lg',
            isApprove ? 'bg-success/10' : 'bg-danger/10'
          )}>
            <AlertCircle className={clsx(
              'h-5 w-5 flex-shrink-0 mt-0.5',
              isApprove ? 'text-success' : 'text-danger'
            )} />
            <div>
              <p className={clsx(
                'font-medium',
                isApprove ? 'text-success' : 'text-danger'
              )}>
                {isApprove ? '确认通过此条安全区配置？' : '确认回滚此条安全区配置？'}
              </p>
              {sensorCode && (
                <p className="mt-1 text-sm text-gray-600">
                  传感器编号：<span className="font-mono">{sensorCode}</span>
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              复核意见 <span className="text-danger">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value)
                if (error) setError(null)
              }}
              placeholder={isApprove ? '请说明通过的原因...' : '请说明回滚的原因...'}
              rows={4}
              className={clsx(
                'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors resize-none',
                error ? 'border-danger' : 'border-gray-300 focus:border-primary'
              )}
            />
            {error && (
              <p className="mt-1.5 text-sm text-danger flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={clsx(
              'px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2',
              isApprove
                ? 'bg-success hover:bg-success/90'
                : 'bg-danger hover:bg-danger/90'
            )}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                处理中...
              </>
            ) : (
              isApprove ? '确认通过' : '确认回滚'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
