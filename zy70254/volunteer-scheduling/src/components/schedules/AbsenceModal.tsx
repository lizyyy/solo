import { useState } from 'react'
import type { Schedule, Volunteer, Course } from '../../types'
import { markAbsence } from '../../services/dataService'

interface AbsenceModalProps {
  schedule: Schedule
  volunteer: Volunteer | undefined
  course: Course | undefined
  onClose: () => void
  onSaved: () => void
}

export function AbsenceModal({ schedule, volunteer, course, onClose, onSaved }: AbsenceModalProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const commonReasons = [
    '突发生病无法参加',
    '有其他紧急事务',
    '交通问题无法按时到达',
    '家庭突发情况',
    '其他原因',
  ]

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('请填写缺席原因')
      return
    }
    setIsSubmitting(true)
    try {
      const result = markAbsence(schedule.id, reason)
      if (result) {
        onSaved()
      } else {
        alert('操作失败，请重试')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h4 className="font-medium text-red-800 mb-2">排班信息</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-red-600">助教：</span>
            <span className="text-red-800">{volunteer?.name || '未知'}</span>
          </div>
          <div>
            <span className="text-red-600">课程：</span>
            <span className="text-red-800">{course?.name || '未知'}</span>
          </div>
          <div>
            <span className="text-red-600">日期：</span>
            <span className="text-red-800">{schedule.date}</span>
          </div>
          <div>
            <span className="text-red-600">时间：</span>
            <span className="text-red-800">{schedule.startTime} - {schedule.endTime}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          缺席原因 <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {commonReasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                reason === r
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="或手动输入缺席原因..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>提示：</strong>标记缺席后，该排班状态将变为「需改派」，需要重新分配其他助教。
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !reason.trim()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? '处理中...' : '确认缺席'}
        </button>
      </div>
    </div>
  )
}
