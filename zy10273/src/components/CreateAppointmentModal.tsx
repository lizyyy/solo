import { useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '../store'
import { ApplianceType } from '../types'

interface CreateAppointmentModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateAppointmentModal({ isOpen, onClose }: CreateAppointmentModalProps) {
  const { addAppointment } = useAppStore()
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    applianceType: ApplianceType.OTHER,
    applianceBrand: '',
    applianceModel: '',
    applianceAge: 1,
    estimatedPrice: 0,
    technician: '张师傅',
    scheduledDate: new Date().toISOString().slice(0, 16),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const result = addAppointment(formData)
    if (result.success) {
      onClose()
      setFormData({
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        applianceType: ApplianceType.OTHER,
        applianceBrand: '',
        applianceModel: '',
        applianceAge: 1,
        estimatedPrice: 0,
        technician: '张师傅',
        scheduledDate: new Date().toISOString().slice(0, 16),
      })
    } else {
      setError(result.error || '')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">新建预约</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">客户信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">客户姓名</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input
                  type="tel"
                  required
                  value={formData.customerPhone}
                  onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">上门地址</label>
              <input
                type="text"
                required
                value={formData.customerAddress}
                onChange={e => setFormData({ ...formData, customerAddress: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">家电信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">家电类型</label>
                <select
                  value={formData.applianceType}
                  onChange={e => setFormData({ ...formData, applianceType: e.target.value as ApplianceType })}
                  className="input"
                >
                  <option value={ApplianceType.TV}>电视</option>
                  <option value={ApplianceType.REFRIGERATOR}>冰箱</option>
                  <option value={ApplianceType.WASHING_MACHINE}>洗衣机</option>
                  <option value={ApplianceType.AIR_CONDITIONER}>空调</option>
                  <option value={ApplianceType.WATER_HEATER}>热水器</option>
                  <option value={ApplianceType.OTHER}>其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">品牌</label>
                <input
                  type="text"
                  required
                  value={formData.applianceBrand}
                  onChange={e => setFormData({ ...formData, applianceBrand: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">型号</label>
                <input
                  type="text"
                  required
                  value={formData.applianceModel}
                  onChange={e => setFormData({ ...formData, applianceModel: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">使用年限</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.applianceAge}
                  onChange={e => setFormData({ ...formData, applianceAge: parseInt(e.target.value) })}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">预约信息</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">上门师傅</label>
                <input
                  type="text"
                  required
                  value={formData.technician}
                  onChange={e => setFormData({ ...formData, technician: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预约时间</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.scheduledDate}
                  onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预估价格 (元)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.estimatedPrice}
                  onChange={e => setFormData({ ...formData, estimatedPrice: parseInt(e.target.value) })}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              创建预约
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
