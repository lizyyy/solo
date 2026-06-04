import { useState, useEffect } from 'react'
import { X, GitCompare, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { HistoryDiff } from '@/types'

const fieldLabels: Record<string, string> = {
  id: 'ID',
  sensor_id: '传感器ID',
  sensor_code: '传感器编号',
  batch_id: '批次ID',
  material_type: '物料类型',
  rpm_min: '最小转速',
  rpm_max: '最大转速',
  coefficient: '安全系数',
  coefficient_source: '系数来源',
  coefficient_reason: '修改原因',
  coefficient_manual: '人工修改',
  review_status: '复核状态',
  reviewer: '复核人',
  review_comment: '复核意见',
  reviewed_at: '复核时间',
  version: '版本号',
  remark: '备注',
  created_at: '创建时间',
  updated_at: '更新时间',
}

interface DiffModalProps {
  isOpen: boolean
  onClose: () => void
  recordId: string | null
  fetchDiff: (recordId: string) => Promise<HistoryDiff>
}

export default function DiffModal({ isOpen, onClose, recordId, fetchDiff }: DiffModalProps) {
  const [diff, setDiff] = useState<HistoryDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && recordId) {
      loadDiff()
    } else {
      setDiff(null)
      setError(null)
    }
  }, [isOpen, recordId])

  const loadDiff = async () => {
    if (!recordId) return

    setLoading(true)
    setError(null)

    try {
      const data = await fetchDiff(recordId)
      setDiff(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取差异数据失败')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const allKeys = new Set<string>()
  if (diff) {
    Object.keys(diff.before).forEach(k => allKeys.add(k))
    Object.keys(diff.after).forEach(k => allKeys.add(k))
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'boolean') return value ? '是' : '否'
    return String(value)
  }

  const isDifferent = (key: string): boolean => {
    if (!diff) return false
    const before = diff.before[key]
    const after = diff.after[key]
    return before !== after
  }

  const getFieldLabel = (key: string): string => {
    return fieldLabels[key] || key
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <GitCompare className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-gray-900">变更详情对比</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted">加载差异数据中...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertCircle className="h-8 w-8 text-danger" />
                <p className="text-sm text-danger">{error}</p>
                <button
                  onClick={loadDiff}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {diff && !loading && !error && (
            <div className="h-full overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                      字段
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-danger uppercase tracking-wider w-[35%]">
                      变更前
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-success uppercase tracking-wider w-[35%]">
                      变更后
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Array.from(allKeys).map((key) => {
                    const different = isDifferent(key)
                    return (
                      <tr
                        key={key}
                        className={clsx(
                          'transition-colors',
                          different ? 'bg-warning/20 hover:bg-warning/30' : 'hover:bg-gray-50'
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">
                          {getFieldLabel(key)}
                        </td>
                        <td className={clsx(
                          'px-4 py-3 font-mono text-sm',
                          different ? 'text-danger line-through' : 'text-gray-500'
                        )}>
                          {formatValue(diff.before[key])}
                        </td>
                        <td className={clsx(
                          'px-4 py-3 font-mono text-sm',
                          different ? 'text-success font-medium' : 'text-gray-500'
                        )}>
                          {formatValue(diff.after[key])}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
