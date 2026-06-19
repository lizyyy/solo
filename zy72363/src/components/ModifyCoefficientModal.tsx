import { useState, useCallback } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { updateSensorCoefficient } from '@/lib/api'
import type { SensorData } from '@/types'

interface ModifyCoefficientModalProps {
  isOpen: boolean
  onClose: () => void
  sensor: SensorData | null
  onSuccess: () => void
}

export default function ModifyCoefficientModal({
  isOpen,
  onClose,
  sensor,
  onSuccess,
}: ModifyCoefficientModalProps) {
  const [coefficient, setCoefficient] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetState = useCallback(() => {
    setCoefficient('')
    setReason('')
    setError(null)
    setIsLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!sensor) return

    const numCoefficient = parseFloat(coefficient)
    if (isNaN(numCoefficient) || numCoefficient <= 0) {
      setError('请输入有效的安全系数')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await updateSensorCoefficient(sensor.id, numCoefficient, reason.trim(), '设备工程师')
      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !sensor) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">修改安全系数</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-muted hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              传感器编号
            </label>
            <p className="font-mono text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {sensor.sensor_code}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              当前安全系数
            </label>
            <p className="font-mono text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {sensor.coefficient.toFixed(2)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新安全系数 <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
              placeholder="请输入新的安全系数"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              修改原因
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入修改原因（未填写将标记为未写原因）"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
            {!reason.trim() && (
              <p className="mt-1 text-xs text-warning flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                未填写原因将标记为&quot;未写原因&quot;
              </p>
            )}
          </div>

          {error && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading || !coefficient}
              className={clsx(
                'px-6 py-2 rounded-lg text-white transition-colors',
                isLoading || !coefficient
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90'
              )}
            >
              {isLoading ? '保存中...' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
