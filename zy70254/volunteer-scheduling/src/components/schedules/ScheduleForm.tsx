import React, { useState, useMemo } from 'react'
import type { Schedule, Volunteer, Course, Campus } from '../../types'
import { addSchedule, updateSchedule, getSchedules } from '../../services/dataService'
import { validateSchedule } from '../../utils/validation'
import type { ValidationError } from '../../types'

interface ScheduleFormProps {
  schedule: Schedule | null
  volunteers: Volunteer[]
  courses: Course[]
  campuses: Campus[]
  onClose: () => void
  onSaved: () => void
}

export function ScheduleForm({ schedule, volunteers, courses, onClose, onSaved }: ScheduleFormProps) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(
    schedule ? courses.find((c) => c.id === schedule.courseId) || null : null
  )

  const [formData, setFormData] = useState({
    courseId: schedule?.courseId || '',
    volunteerId: schedule?.volunteerId || '',
    date: schedule?.date || new Date().toISOString().split('T')[0],
    startTime: schedule?.startTime || '16:00',
    endTime: schedule?.endTime || '17:30',
    status: schedule?.status || '待确认' as Schedule['status'],
  })

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  const availableVolunteers = useMemo(() => {
    if (!selectedCourse) return volunteers.filter((v) => v.status === 'active')
    return volunteers.filter((v) => {
      if (v.status !== 'active') return false
      const hasSubject = v.subjects.includes(selectedCourse.subject)
      const hasCampus = v.availableCampuses.includes(selectedCourse.campusId)
      return hasSubject && hasCampus
    })
  }, [volunteers, selectedCourse])

  const errors = useMemo(() => {
    return validateSchedule(formData, getSchedules(), volunteers, courses)
  }, [formData, volunteers, courses])

  const handleCourseChange = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId)
    setSelectedCourse(course || null)
    setFormData((prev) => ({
      ...prev,
      courseId,
      startTime: course?.startTime || prev.startTime,
      endTime: course?.endTime || prev.endTime,
    }))
  }

  const calculateHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors(errors)
    const hasErrors = errors.some((e) => e.type === 'error')
    if (hasErrors) {
      alert('表单有误，请检查红色标记的字段和警告信息')
      return
    }

    const assignedHours = calculateHours(formData.startTime, formData.endTime)

    try {
      if (schedule) {
        updateSchedule(schedule.id, {
          ...formData,
          assignedHours,
        })
      } else {
        addSchedule({
          ...formData,
          assignedHours,
        })
      }
      onSaved()
      onClose()
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败，请重试')
    }
  }

  const getFieldError = (field: string) => {
    return validationErrors.find((e) => e.field === field && e.type === 'error')?.message
  }

  const getFieldWarning = (field: string) => {
    return validationErrors.find((e) => e.field === field && e.type === 'warning')?.message
  }

  const activeVolunteers = volunteers.filter((v) => v.status === 'active')
  const activeCourses = courses.filter((c) => c.status === 'active')

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">排班校验提示</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 先选择课程，系统会自动筛选匹配的助教</li>
          <li>• 助教必须擅长该课程的学科且服务于对应校区</li>
          <li>• 系统会自动检查时间段冲突</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            课程 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.courseId}
            onChange={(e) => handleCourseChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('courseId') ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">请选择课程</option>
            {activeCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subject})
              </option>
            ))}
          </select>
          {getFieldError('courseId') && <p className="text-red-500 text-sm mt-1">{getFieldError('courseId')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            助教 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.volunteerId}
            onChange={(e) => setFormData((prev) => ({ ...prev, volunteerId: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('volunteerId') ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">请选择助教</option>
            {availableVolunteers.length > 0 ? (
              availableVolunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.phone})
                </option>
              ))
            ) : (
              <option value="" disabled>
                {selectedCourse ? '暂无匹配的助教，请先选择课程' : '暂无活跃助教'}
              </option>
            )}
          </select>
          {getFieldError('volunteerId') && <p className="text-red-500 text-sm mt-1">{getFieldError('volunteerId')}</p>}
          {getFieldWarning('volunteerId') && <p className="text-yellow-600 text-sm mt-1">{getFieldWarning('volunteerId')}</p>}
          {selectedCourse && availableVolunteers.length === 0 && activeVolunteers.length > 0 && (
            <p className="text-orange-600 text-sm mt-1">
              提示：没有助教同时擅长「{selectedCourse.subject}」且服务于该课程所在校区
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            日期 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('date') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('date') && <p className="text-red-500 text-sm mt-1">{getFieldError('date')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Schedule['status'] }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="待确认">待确认</option>
            <option value="已确认">已确认</option>
            <option value="进行中">进行中</option>
            <option value="已完成">已完成</option>
            <option value="已取消">已取消</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            开始时间 <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('startTime') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('startTime') && <p className="text-red-500 text-sm mt-1">{getFieldError('startTime')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            结束时间 <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('endTime') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('endTime') && <p className="text-red-500 text-sm mt-1">{getFieldError('endTime')}</p>}
        </div>
      </div>

      {selectedCourse && formData.volunteerId && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-700 mb-2">匹配校验结果</h4>
          {(() => {
            const volunteer = volunteers.find((v) => v.id === formData.volunteerId)
            if (!volunteer) return null
            const subjectMatch = volunteer.subjects.includes(selectedCourse.subject)
            const campusMatch = volunteer.availableCampuses.includes(selectedCourse.campusId)
            return (
              <div className="space-y-1 text-sm">
                <div className={`flex items-center gap-2 ${subjectMatch ? 'text-green-600' : 'text-red-600'}`}>
                  <span>{subjectMatch ? '✓' : '✗'}</span>
                  <span>学科匹配：{volunteer.subjects.join('、')} {subjectMatch ? '包含' : '不包含'} {selectedCourse.subject}</span>
                </div>
                <div className={`flex items-center gap-2 ${campusMatch ? 'text-green-600' : 'text-red-600'}`}>
                  <span>{campusMatch ? '✓' : '✗'}</span>
                  <span>校区匹配：{campusMatch ? '助教可服务该校区' : '助教不服务该校区'}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">校验问题：</h4>
          <ul className="text-sm space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index} className={error.type === 'error' ? 'text-red-700' : 'text-yellow-700'}>
                • {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {schedule ? '保存修改' : '创建排班'}
        </button>
      </div>
    </form>
  )
}
