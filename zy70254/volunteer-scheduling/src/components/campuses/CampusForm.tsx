import React, { useState, useMemo } from 'react'
import type { Campus } from '../../types'
import { addCampus, updateCampus, getCampuses } from '../../services/dataService'
import { validateCampus, DAYS_OF_WEEK } from '../../utils/validation'
import type { ValidationError } from '../../types'

interface CampusFormProps {
  campus: Campus | null
  onClose: () => void
  onSaved: () => void
}

export function CampusForm({ campus, onClose, onSaved }: CampusFormProps) {
  const [formData, setFormData] = useState({
    name: campus?.name || '',
    address: campus?.address || '',
    capacity: campus?.capacity || 100,
    maxVolunteersPerClass: campus?.maxVolunteersPerClass || 2,
    operatingDays: campus?.operatingDays || ([] as string[]),
    contactPerson: campus?.contactPerson || '',
    contactPhone: campus?.contactPhone || '',
    status: campus?.status || 'active' as 'active' | 'inactive',
  })

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  const errors = useMemo(() => {
    return validateCampus(formData, getCampuses())
  }, [formData])

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      operatingDays: prev.operatingDays.includes(day)
        ? prev.operatingDays.filter((d) => d !== day)
        : [...prev.operatingDays, day],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationErrors(errors)
    const hasErrors = errors.some((e) => e.type === 'error')
    if (hasErrors) {
      alert('表单有误，请检查红色标记的字段')
      return
    }

    try {
      if (campus) {
        updateCampus(campus.id, formData)
      } else {
        addCampus(formData)
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
            校区名称 <span className="text-red-500">*</span>
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

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            校区地址 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('address') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('address') && <p className="text-red-500 text-sm mt-1">{getFieldError('address')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            容量 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.capacity}
            onChange={(e) => setFormData((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('capacity') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('capacity') && <p className="text-red-500 text-sm mt-1">{getFieldError('capacity')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            每班最大志愿者数 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={formData.maxVolunteersPerClass}
            onChange={(e) => setFormData((prev) => ({ ...prev, maxVolunteersPerClass: Number(e.target.value) }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('maxVolunteersPerClass') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('maxVolunteersPerClass') && <p className="text-red-500 text-sm mt-1">{getFieldError('maxVolunteersPerClass')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            联系人 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.contactPerson}
            onChange={(e) => setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('contactPerson') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('contactPerson') && <p className="text-red-500 text-sm mt-1">{getFieldError('contactPerson')}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            联系电话 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.contactPhone}
            onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getFieldError('contactPhone') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {getFieldError('contactPhone') && <p className="text-red-500 text-sm mt-1">{getFieldError('contactPhone')}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          运营日
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                formData.operatingDays.includes(day)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        {getFieldWarning('operatingDays') && <p className="text-yellow-600 text-sm mt-1">{getFieldWarning('operatingDays')}</p>}
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
          {campus ? '保存修改' : '创建校区'}
        </button>
      </div>
    </form>
  )
}
