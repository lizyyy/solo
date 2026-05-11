import { useState, useMemo } from 'react'
import type { Schedule, Volunteer, Course, Campus } from '../../types'
import { reassignSchedule, getSchedules } from '../../services/dataService'
import { validateSchedule } from '../../utils/validation'

interface ReassignModalProps {
  schedule: Schedule
  volunteers: Volunteer[]
  courses: Course[]
  campuses: Campus[]
  onClose: () => void
  onSaved: () => void
}

export function ReassignModal({ schedule, volunteers, courses, campuses, onClose, onSaved }: ReassignModalProps) {
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const course = courses.find((c) => c.id === schedule.courseId)
  const campus = campuses.find((c) => c.id === course?.campusId)
  const originalVolunteer = volunteers.find((v) => v.id === schedule.volunteerId)

  const eligibleVolunteers = useMemo(() => {
    if (!course) return []
    return volunteers.filter((v) => {
      if (v.status !== 'active') return false
      if (v.id === schedule.volunteerId) return false
      const hasSubject = v.subjects.includes(course.subject)
      const hasCampus = v.availableCampuses.includes(course.campusId)
      return hasSubject && hasCampus
    })
  }, [volunteers, course, schedule.volunteerId])

  const handleSubmit = async () => {
    if (!selectedVolunteerId) {
      alert('请选择新的助教')
      return
    }

    const newSchedule = {
      courseId: schedule.courseId,
      volunteerId: selectedVolunteerId,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: '待确认' as const,
    }

    const validationErrors = validateSchedule(
      newSchedule,
      getSchedules(),
      volunteers,
      courses
    )

    const errorMessages = validationErrors.filter((e) => e.type === 'error').map((e) => e.message)
    if (errorMessages.length > 0) {
      setErrors(errorMessages)
      return
    }

    setIsSubmitting(true)
    try {
      const result = reassignSchedule(schedule.id, selectedVolunteerId, reason)
      if (result) {
        onSaved()
      } else {
        alert('改派失败，请重试')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h4 className="font-medium text-orange-800 mb-3">原排班信息</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-orange-600">原助教：</span>
            <span className="text-orange-800 font-medium">{originalVolunteer?.name || '未知'}</span>
          </div>
          <div>
            <span className="text-orange-600">课程：</span>
            <span className="text-orange-800 font-medium">{course?.name || '未知'}</span>
          </div>
          <div>
            <span className="text-orange-600">校区：</span>
            <span className="text-orange-800 font-medium">{campus?.name || '未知'}</span>
          </div>
          <div>
            <span className="text-orange-600">学科：</span>
            <span className="text-orange-800 font-medium">{course?.subject || '未知'}</span>
          </div>
          <div>
            <span className="text-orange-600">日期：</span>
            <span className="text-orange-800 font-medium">{schedule.date}</span>
          </div>
          <div>
            <span className="text-orange-600">时间：</span>
            <span className="text-orange-800 font-medium">{schedule.startTime} - {schedule.endTime}</span>
          </div>
          <div className="col-span-2">
            <span className="text-orange-600">缺席原因：</span>
            <span className="text-orange-800">{schedule.absenceReason || '未知'}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择新助教 <span className="text-red-500">*</span>
        </label>
        {eligibleVolunteers.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
            {eligibleVolunteers.map((v) => (
              <label
                key={v.id}
                className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedVolunteerId === v.id ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="volunteer"
                  value={v.id}
                  checked={selectedVolunteerId === v.id}
                  onChange={(e) => setSelectedVolunteerId(e.target.value)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{v.name}</div>
                  <div className="text-sm text-gray-500">
                    {v.phone}
                    {v.email && ` · ${v.email}`}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {v.subjects.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  已服务 <span className="font-medium">{v.totalAssignedHours}</span> 小时
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
            <p className="font-medium">没有符合条件的助教</p>
            <p className="text-sm mt-1">需要同时满足：擅长「{course?.subject}」学科且服务于「{campus?.name}」校区</p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          改派备注（可选）
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="例如：原助教科目冲突，临时改派..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">校验失败：</h4>
          <ul className="text-sm space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-red-700">
                • {error}
              </li>
            ))}
          </ul>
        </div>
      )}

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
          disabled={isSubmitting || !selectedVolunteerId}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? '处理中...' : '确认改派'}
        </button>
      </div>
    </div>
  )
}
