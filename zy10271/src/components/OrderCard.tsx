import React, { useState } from 'react'
import { Order } from '../types'
import { STATUS_LABELS, STATUS_COLORS, getNextStatus, formatDate } from '../utils/statusUtils'
import { useOrderContext } from '../store/OrderContext'
import { Eye, Clock, RotateCcw, Check, ChevronRight, History } from 'lucide-react'

interface OrderCardProps {
  order: Order
}

export const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const { updateOrderStatus, canPickup } = useOrderContext()
  const [showHistory, setShowHistory] = useState(false)
  const operator = '李师傅'

  const nextStatus = getNextStatus(order.status)
  const canAdvance = nextStatus && order.status !== 'picked-up' && order.status !== 'rework'

  const handleAdvance = () => {
    if (!nextStatus) return
    try {
      updateOrderStatus(order.id, nextStatus, operator)
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleRework = () => {
    try {
      updateOrderStatus(order.id, 'rework', operator, '质检未通过，开始返工')
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleQualityPass = () => {
    try {
      updateOrderStatus(order.id, 'ready', operator, '质检通过')
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handlePickup = () => {
    if (!canPickup(order)) {
      alert('未通过质检的订单不能取镜')
      return
    }
    try {
      updateOrderStatus(order.id, 'picked-up', operator, '客户已取镜')
    } catch (error) {
      alert((error as Error).message)
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-md border-2 p-4 ${
      order.reworkCount > 0 ? 'border-red-200' : 'border-gray-100'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg">{order.customerName}</h3>
            {order.reworkCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                返工 {order.reworkCount} 次
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{order.orderNo}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-blue-50 p-2 rounded">
          <div className="flex items-center gap-1 text-blue-600 mb-1">
            <Eye size={14} />
            <span className="font-medium">左眼 (L)</span>
          </div>
          <p>S: {order.leftEye.sphere} | C: {order.leftEye.cylinder} | A: {order.leftEye.axis}°</p>
        </div>
        <div className="bg-green-50 p-2 rounded">
          <div className="flex items-center gap-1 text-green-600 mb-1">
            <Eye size={14} />
            <span className="font-medium">右眼 (R)</span>
          </div>
          <p>S: {order.rightEye.sphere} | C: {order.rightEye.cylinder} | A: {order.rightEye.axis}°</p>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        <p>镜片: {order.lens.brand} {order.lens.refractiveIndex} {order.lens.coating}</p>
        {order.frame && <p>镜框: {order.frame}</p>}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <Clock size={12} />
        <span>创建于 {formatDate(order.createdAt)}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {canAdvance && (
          <button
            onClick={handleAdvance}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition"
          >
            下一步
            <ChevronRight size={14} />
          </button>
        )}

        {order.status === 'quality-check' && !order.qualityCheck && (
          <>
            <button
              onClick={handleQualityPass}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition"
            >
              <Check size={14} />
              质检通过
            </button>
            <button
              onClick={handleRework}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
            >
              <RotateCcw size={14} />
              返工
            </button>
          </>
        )}

        {order.status === 'rework' && (
          <button
            onClick={() => updateOrderStatus(order.id, 'measuring', operator, '返工重新测量')}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition"
          >
            <RotateCcw size={14} />
            重新开始加工
          </button>
        )}

        {order.status === 'ready' && (
          <button
            onClick={handlePickup}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600 transition"
          >
            <Check size={14} />
            确认取镜
          </button>
        )}

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition"
        >
          <History size={14} />
          历史
        </button>
      </div>

      {showHistory && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium text-sm mb-2">状态历史</h4>
          <div className="space-y-2">
            {order.history.slice().reverse().map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded ${STATUS_COLORS[entry.status].split(' ')[0]} ${STATUS_COLORS[entry.status].split(' ')[1]}`}>
                  {STATUS_LABELS[entry.status]}
                </span>
                <span className="text-gray-500">{formatDate(entry.timestamp)}</span>
                <span className="text-gray-400">- {entry.operator}</span>
                {entry.remarks && <span className="text-gray-600">({entry.remarks})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
