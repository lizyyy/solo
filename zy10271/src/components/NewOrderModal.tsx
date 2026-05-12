import React, { useState } from 'react'
import { useOrderContext } from '../store/OrderContext'
import { X, Plus } from 'lucide-react'

interface NewOrderModalProps {
  isOpen: boolean
  onClose: () => void
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({ isOpen, onClose }) => {
  const { addOrder, validateEyeParams } = useOrderContext()
  const [errors, setErrors] = useState<string[]>([])

  const [formData, setFormData] = useState({
    orderNo: '',
    customerName: '',
    phone: '',
    leftEye: { sphere: 0, cylinder: 0, axis: 90 },
    rightEye: { sphere: 0, cylinder: 0, axis: 90 },
    lens: { brand: '依视路', refractiveIndex: '1.56', coating: '防蓝光', type: 'single-vision' as const },
    frame: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const validation = validateEyeParams(formData.leftEye, formData.rightEye)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    try {
      addOrder(formData)
      onClose()
      setFormData({
        orderNo: '',
        customerName: '',
        phone: '',
        leftEye: { sphere: 0, cylinder: 0, axis: 90 },
        rightEye: { sphere: 0, cylinder: 0, axis: 90 },
        lens: { brand: '依视路', refractiveIndex: '1.56', coating: '防蓝光', type: 'single-vision' as const },
        frame: ''
      })
    } catch (error) {
      setErrors([(error as Error).message])
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">新建订单</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              {errors.map((error, i) => (
                <p key={i} className="text-red-600 text-sm">{error}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">订单号</label>
              <input
                type="text"
                required
                value={formData.orderNo}
                onChange={(e) => setFormData({ ...formData, orderNo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如: ORD001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客户姓名</label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-700 mb-3">左眼 (L)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">球镜 (S)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.leftEye.sphere}
                    onChange={(e) => setFormData({
                      ...formData,
                      leftEye: { ...formData.leftEye, sphere: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">柱镜 (C)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.leftEye.cylinder}
                    onChange={(e) => setFormData({
                      ...formData,
                      leftEye: { ...formData.leftEye, cylinder: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">轴位 (A)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={formData.leftEye.axis}
                    onChange={(e) => setFormData({
                      ...formData,
                      leftEye: { ...formData.leftEye, axis: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-700 mb-3">右眼 (R)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">球镜 (S)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.rightEye.sphere}
                    onChange={(e) => setFormData({
                      ...formData,
                      rightEye: { ...formData.rightEye, sphere: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">柱镜 (C)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={formData.rightEye.cylinder}
                    onChange={(e) => setFormData({
                      ...formData,
                      rightEye: { ...formData.rightEye, cylinder: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">轴位 (A)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={formData.rightEye.axis}
                    onChange={(e) => setFormData({
                      ...formData,
                      rightEye: { ...formData.rightEye, axis: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">镜片品牌</label>
              <select
                value={formData.lens.brand}
                onChange={(e) => setFormData({
                  ...formData,
                  lens: { ...formData.lens, brand: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>依视路</option>
                <option>蔡司</option>
                <option>豪雅</option>
                <option>明月</option>
                <option>凯米</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">折射率</label>
              <select
                value={formData.lens.refractiveIndex}
                onChange={(e) => setFormData({
                  ...formData,
                  lens: { ...formData.lens, refractiveIndex: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>1.56</option>
                <option>1.60</option>
                <option>1.67</option>
                <option>1.74</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">镜框</label>
            <input
              type="text"
              value={formData.frame}
              onChange={(e) => setFormData({ ...formData, frame: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="可选"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-2"
            >
              <Plus size={16} />
              创建订单
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
