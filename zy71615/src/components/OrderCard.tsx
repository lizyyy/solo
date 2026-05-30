import { useDrag } from '../hooks/useDrag'
import type { Order } from '../engine/types'
import { getCommodityEmoji } from '../engine/orderGenerator'
import { ORDER_STATUS_LABELS } from '../engine/types'
import { AlertCircle, Package } from 'lucide-react'

interface OrderCardProps {
  order: Order
  onCancel?: () => void
  disabled?: boolean
}

export function OrderCard({ order, onCancel, disabled }: OrderCardProps) {
  const { drag, isDragging } = useDrag({
    type: 'order',
    data: { orderId: order.id },
    disabled: order.status !== 'pending' || disabled,
  })

  const emoji = getCommodityEmoji(order.commodity)
  const isDeadline = order.deadlineRound <= 1
  const isLoaded = order.status === 'loaded'
  const isBreached = order.status === 'breached'

  return (
    <div
      ref={drag}
      className={`
        relative p-4 rounded-lg border-2 transition-all duration-200
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isLoaded ? 'bg-green-50 border-green-400' : ''}
        ${isBreached ? 'bg-red-50 border-red-400 opacity-60' : ''}
        ${!isLoaded && !isBreached ? 'bg-amber-50 border-amber-300 hover:border-amber-500 hover:shadow-md' : ''}
        ${order.status === 'pending' ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="font-bold text-slate-800">{order.commodity}</div>
            <div className="text-xs text-slate-500">{order.id}</div>
          </div>
        </div>
        <span className={`
          text-xs px-2 py-1 rounded
          ${isLoaded ? 'bg-green-100 text-green-700' : ''}
          ${isBreached ? 'bg-red-100 text-red-700' : ''}
          ${order.status === 'pending' ? 'bg-amber-100 text-amber-700' : ''}
        `}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">数量</span>
          <span className="font-medium text-slate-700 flex items-center gap-1">
            <Package size={14} />
            {order.quantity} 柜
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">报价</span>
          <span className="font-bold text-amber-700">
            ${order.foreignPrice.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500">截止回合</span>
          <span className={`font-medium ${isDeadline ? 'text-red-600' : 'text-slate-700'} flex items-center gap-1`}>
            {isDeadline && <AlertCircle size={14} />}
            R{order.deadlineRound}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">违约金</span>
          <span className="font-medium text-red-600">
            {(order.breachRate * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {isLoaded && onCancel && (
        <button
          onClick={(e) => { e.stopPropagation(); onCancel() }}
          className="mt-3 w-full py-1 text-sm text-red-600 hover:bg-red-100 rounded transition-colors"
        >
          取消装载
        </button>
      )}
    </div>
  )
}
