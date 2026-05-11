import React, { useState, useMemo } from 'react'
import type { Volunteer, Campus, Subject } from '../../types'
import { addVolunteer, updateVolunteer, getVolunteers } from '../../services/dataService'
import { validateVolunteer, SUBJECTS } from '../../utils/validation'
import type { ValidationError } from '../../types'

interface VolunteerFormProps {
  volunteer: Volunteer | null
  campuses: Campus[]
  onClose: () => void
  onSaved: () => void
}

export function VolunteerForm({ volunteer, campuses, onClose, onSaved }: VolunteerFormProps) {
  const [formData, setFormData] = useState({
    name: volunteer?.name || '',
    phone: volunteer?.phone || '',
    email: volunteer?.email || '',
    subjects: volunteer?.subjects || ([] as Subject[]),
    availableCampuses: volunteer?.availableCampuses || ([] as string[]),
    volunteerHours: volunteer?.volunteerHours || 0,
    status: volunteer?.status || 'active' as 'active' | 'inactive',
  })

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  const errors = useMemo(() => {
    return validateVolunteer(formData, getVolunteers())
  }, [formData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors(errors)
    const hasErrors = errors.some((e) => e.type === 'error')
    if (hasErrors) {
      alert('表单有误，请检查红色标记的字段')
      return
    }

    try {
      if (volunteer) {
        updateVolunteer(volunteer.id, formData)
      } else {
        addVolunteer({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          subjects: formData.subjects,
          availableCampuses: formData.availableCampuses,
          volunteerHours: formData.volunteerHours,
          status: formData.status,
        })
      }
      onSaved()
      onClose()
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败，请重试')
    }
  }

  const toggleSubject = (subject: Subject) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }))
  }

  const toggleCampus = (campusId: string) => {
    setFormData((prev) => ({
      ...prev,
      availableCampuses: prev.availableCampuses.includes(campusId)
        ? prev.availableCampuses.filter((c) => c !== campusId)
        : [...prev.availableCampuses, campusId],
    }))
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
            姓名 <span className="text-red-500">*</span>
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
            手机号 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('phone') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('phone') && <p className="text-red-500 text-sm mt-1">{getFieldError('phone')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('email') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('email') && <p className="text-red-500 text-sm mt-1">{getFieldError('email')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            总志愿时长（小时）
          </label>
          <input
            type="number"
            min="0"
            value={formData.volunteerHours}
            onChange={(e) => setFormData((prev) => ({ ...prev, volunteerHours: Number(e.target.value) }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('volunteerHours') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('volunteerHours') && <p className="text-red-500 text-sm mt-1">{getFieldError('volunteerHours')}</p>}
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          擅长学科 <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => toggleSubject(subject)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                formData.subjects.includes(subject)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>
        {getFieldError('subjects') && <p className="text-red-500 text-sm mt-1">{getFieldError('subjects')}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          可服务校区
        </label>
        <div className="space-y-2">
          {campuses.map((campus) => (
            <label key={campus.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.availableCampuses.includes(campus.id)}
                onChange={() => toggleCampus(campus.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                {campus.name}
                <span className="text-gray-400"> - {campus.address}</span>
              </span>
            </label>
          ))}
        </div>
        {getFieldWarning('availableCampuses') && <p className="text-yellow-600 text-sm mt-1">{getFieldWarning('availableCampuses')}</p>}
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
          {volunteer ? '保存修改' : '创建助教'}
        </button>
      </div>
    </form>
  )
}
