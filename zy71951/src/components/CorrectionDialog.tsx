import { useState } from 'react'
import { X } from 'lucide-react'
import type { CreateCorrectionRequest } from '@/types'
import { cn } from '@/lib/utils'

const CORRECTABLE_FIELDS = [
  { value: 'towerId', label: '杆塔编号' },
  { value: 'towerName', label: '杆塔名称' },
  { value: 'flightDate', label: '飞行日期' },
  { value: 'flightTime', label: '飞行时间' },
  { value: 'pilotName', label: '飞手姓名' },
]

interface CorrectionDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateCorrectionRequest) => void
  submitting?: boolean
}

export default function CorrectionDialog({ open, onClose, onSubmit, submitting }: CorrectionDialogProps) {
  const [fieldName, setFieldName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!open) return null

  function validate() {
    const e: Record<string, string> = {}
    if (!fieldName) e.fieldName = '请选择更正字段'
    if (!newValue.trim()) e.newValue = '请输入新值'
    if (!reason.trim()) e.reason = '请输入更正原因（必填）'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSubmit({ fieldName, newValue: newValue.trim(), reason: reason.trim(), correctedBy: '' })
    setFieldName('')
    setNewValue('')
    setReason('')
    setErrors({})
  }

  function handleClose() {
    setFieldName('')
    setNewValue('')
    setReason('')
    setErrors({})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-primary">人工更正</h3>
          <button type="button" onClick={handleClose} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">更正字段</label>
            <select
              value={fieldName}
              onChange={(e) => { setFieldName(e.target.value); setErrors((p) => ({ ...p, fieldName: '' })) }}
              className={cn('input-base', errors.fieldName && 'border-danger')}
            >
              <option value="">请选择字段</option>
              {CORRECTABLE_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            {errors.fieldName && <p className="text-xs text-danger mt-1">{errors.fieldName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">新值</label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => { setNewValue(e.target.value); setErrors((p) => ({ ...p, newValue: '' })) }}
              placeholder="输入更正后的值"
              className={cn('input-base', errors.newValue && 'border-danger')}
            />
            {errors.newValue && <p className="text-xs text-danger mt-1">{errors.newValue}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              更正原因 <span className="text-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setErrors((p) => ({ ...p, reason: '' })) }}
              placeholder="请说明更正原因（必填）"
              rows={3}
              className={cn('input-base resize-none', errors.reason && 'border-danger')}
            />
            {errors.reason && <p className="text-xs text-danger mt-1">{errors.reason}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" className="btn-secondary text-sm" onClick={handleClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? '提交中…' : '确认更正'}
          </button>
        </div>
      </div>
    </div>
  )
}

