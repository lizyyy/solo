import { useState, useEffect } from 'react'
import { X, FileText, Calendar, Tag, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import type { ConfirmationRecord } from '@/lib/api'

interface TaxRemarkPanelProps {
  onClose: () => void
}

interface RemarkRow {
  recordId: string
  businessNo: string
  screenshotDate: string
  amount: number
  remarkDate: string
  taxRateRemark: string
  caliberType: 'new' | 'old'
  originalTaxRateRemark: string | null
  originalCaliberType: string | null
}

export default function TaxRemarkPanel({ onClose }: TaxRemarkPanelProps) {
  const { currentBatch, fetchRecords, records, taxRemarkReview } = useStore()
  const [remarkRows, setRemarkRows] = useState<RemarkRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (currentBatch) {
      fetchRecords({ batchId: currentBatch.id })
    }
  }, [currentBatch, fetchRecords])

  useEffect(() => {
    if (records.length > 0 && remarkRows.length === 0) {
      const rows: RemarkRow[] = records.map((r: ConfirmationRecord) => ({
        recordId: r.id,
        businessNo: r.business_no,
        screenshotDate: r.ex_dividend_date || '',
        amount: r.amount,
        remarkDate: r.ex_dividend_date || '',
        taxRateRemark: r.tax_rate_remark || '',
        caliberType: (r.caliber_type as 'new' | 'old') || 'new',
        originalTaxRateRemark: r.tax_rate_remark,
        originalCaliberType: r.caliber_type,
      }))
      setRemarkRows(rows)
    }
  }, [records])

  const updateRow = (idx: number, field: keyof RemarkRow, value: string) => {
    setRemarkRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const hasChanges = (row: RemarkRow) => {
    const dateChanged = row.remarkDate !== row.screenshotDate
    const remarkChanged = row.taxRateRemark !== (row.originalTaxRateRemark || '')
    const caliberChanged = row.caliberType !== (row.originalCaliberType || 'new')
    return dateChanged || remarkChanged || caliberChanged
  }

  const handleSubmit = async () => {
    if (!currentBatch) return
    setSubmitting(true)
    try {
      const reviewData = remarkRows
        .filter(hasChanges)
        .map(row => ({
          recordId: row.recordId,
          exDividendDate: row.remarkDate,
          taxRateRemark: row.taxRateRemark,
          caliberType: row.caliberType,
        }))
      if (reviewData.length === 0) return
      await taxRemarkReview(currentBatch.id, reviewData)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex w-[720px] flex-col bg-white shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--color-amber)]" />
            <h3 className="text-lg font-bold text-gray-900">补看税费率备注</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-700">
            逐条核对税费率备注。若备注中的除权日与截图不一致，系统将生成冲突差异待裁决；若备注含旧口径数据，将标记为旧口径补录。
          </div>

          {remarkRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">当前批次暂无记录</div>
          ) : (
            <div className="flex flex-col gap-4">
              {remarkRows.map((row, idx) => {
                const dateConflicts = row.remarkDate !== row.screenshotDate && row.remarkDate !== ''
                const changed = hasChanges(row)
                return (
                  <div
                    key={row.recordId}
                    className={cn(
                      'rounded-lg border p-4',
                      dateConflicts ? 'border-red-300 bg-red-50/30' : changed ? 'border-amber-200 bg-amber-50/20' : 'border-gray-200'
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-gray-900">{row.businessNo}</span>
                      <div className="flex items-center gap-2">
                        {dateConflicts && (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            日期冲突
                          </span>
                        )}
                        {changed && !dateConflicts && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            已修改
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
                      <div>
                        <span className="font-medium text-gray-700">截图除权日：</span>
                        <span className="font-mono text-gray-900">{row.screenshotDate || '-'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">金额：</span>
                        <span className="font-mono text-gray-900">{row.amount.toLocaleString()}</span>
                      </div>
                    </div>

                    {row.originalTaxRateRemark && (
                      <div className="mb-3 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        <span className="font-medium">原备注：</span>{row.originalTaxRateRemark}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                          <Calendar className="h-3.5 w-3.5" />备注除权日
                        </label>
                        <input
                          type="date"
                          value={row.remarkDate}
                          onChange={e => updateRow(idx, 'remarkDate', e.target.value)}
                          className={cn(
                            'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none',
                            dateConflicts
                              ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-1 focus:ring-red-400'
                              : 'border-gray-300 focus:border-[var(--color-teal)] focus:ring-1 focus:ring-[var(--color-teal)]'
                          )}
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                          <Tag className="h-3.5 w-3.5" />口径类型
                        </label>
                        <select
                          value={row.caliberType}
                          onChange={e => updateRow(idx, 'caliberType', e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-teal)]"
                        >
                          <option value="new">新口径</option>
                          <option value="old">旧口径</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                        <MessageSquare className="h-3.5 w-3.5" />税费率备注
                      </label>
                      <textarea
                        value={row.taxRateRemark}
                        onChange={e => updateRow(idx, 'taxRateRemark', e.target.value)}
                        placeholder="填写税费率备注内容..."
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-teal)]"
                      />
                    </div>

                    {dateConflicts && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        ⚠ 冲突预警：截图除权日 <span className="font-mono font-bold">{row.screenshotDate}</span> 与备注除权日 <span className="font-mono font-bold">{row.remarkDate}</span> 不一致，提交后将生成待裁决差异。
                      </div>
                    )}

                    {row.caliberType === 'old' && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                        ℹ 旧口径标记：提交后将生成旧口径补录差异。
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4">
          {submitted ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-700">补录完成，差异清单已更新</span>
              <button onClick={onClose} className="rounded-lg bg-[var(--color-teal)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
                关闭
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {remarkRows.filter(hasChanges).length} 条记录有修改
              </span>
              <div className="flex gap-3">
                <button onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={remarkRows.filter(hasChanges).length === 0 || submitting}
                  className={cn(
                    'rounded-lg px-5 py-2.5 text-sm font-medium text-white',
                    remarkRows.filter(hasChanges).length > 0
                      ? 'bg-[var(--color-teal)] hover:opacity-90'
                      : 'cursor-not-allowed bg-gray-300'
                  )}
                >
                  {submitting ? '提交中...' : '确认补录'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
