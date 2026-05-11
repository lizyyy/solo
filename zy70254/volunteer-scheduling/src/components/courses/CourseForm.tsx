import React, { useState, useMemo } from 'react'
import type { Course, Campus, Subject } from '../../types'
import { addCourse, updateCourse, getCourses } from '../../services/dataService'
import { validateCourse, SUBJECTS, DAYS_OF_WEEK } from '../../utils/validation'
import type { ValidationError } from '../../types'

interface CourseFormProps {
  course: Course | null
  campuses: Campus[]
  onClose: () => void
  onSaved: () => void
}

export function CourseForm({ course, campuses, onClose, onSaved }: CourseFormProps) {
  const [formData, setFormData] = useState({
    name: course?.name || '',
    subject: (course?.subject || '') as Subject,
    campusId: course?.campusId || '',
    dayOfWeek: course?.dayOfWeek || '',
    startTime: course?.startTime || '',
    endTime: course?.endTime || '',
    requiredVolunteers: course?.requiredVolunteers || 1,
    status: course?.status || 'active' as 'active' | 'inactive',
  })

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  const errors = useMemo(() => {
    return validateCourse(formData, getCourses(), campuses)
  }, [formData, campuses])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors(errors)
    const hasErrors = errors.some((e) => e.type === 'error')
    if (hasErrors) {
      alert('表单有误，请检查红色标记的字段')
      return
    }

    try {
      if (course) {
        updateCourse(course.id, formData)
      } else {
        addCourse(formData)
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            课程名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('name') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('name') && <p className="text-red-500 text-sm mt-1">{getFieldError('name')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            学科 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value as Subject }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('subject') ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">请选择学科</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {getFieldError('subject') && <p className="text-red-500 text-sm mt-1">{getFieldError('subject')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            所属校区 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.campusId}
            onChange={(e) => setFormData((prev) => ({ ...prev, campusId: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('campusId') ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">请选择校区</option>
            {campuses.filter((c) => c.status === 'active').map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {getFieldError('campusId') && <p className="text-red-500 text-sm mt-1">{getFieldError('campusId')}</p>}
          {getFieldWarning('campusId') && <p className="text-yellow-600 text-sm mt-1">{getFieldWarning('campusId')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            上课日 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.dayOfWeek}
            onChange={(e) => setFormData((prev) => ({ ...prev, dayOfWeek: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('dayOfWeek') ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">请选择上课日</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {getFieldError('dayOfWeek') && <p className="text-red-500 text-sm mt-1">{getFieldError('dayOfWeek')}</p>}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            所需助教人数 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.requiredVolunteers}
            onChange={(e) => setFormData((prev) => ({ ...prev, requiredVolunteers: Number(e.target.value) }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('requiredVolunteers') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('requiredVolunteers') && <p className="text-red-500 text-sm mt-1">{getFieldError('requiredVolunteers')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="active">活跃</option>
            <option value="inactive">停用</option>
          </select>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">表单问题：</h4>
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
          {course ? '保存修改' : '创建课程'}
        </button>
      </div>
    </form>
  )
}
