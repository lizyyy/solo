import React from 'react';
import { Phone, Smartphone, Clock, User, ChevronRight, ArrowRight } from 'lucide-react';
import type { Order, OrderStatus } from '../types';
import { STATUS_FLOW } from '../constants/statusFlow';

interface OrderCardProps {
  order: Order;
  onView: (order: Order) => void;
  onUpdateStatus: (orderId: number, newStatus: OrderStatus) => void;
}

export function OrderCard({ order, onView, onUpdateStatus }: OrderCardProps) {
  const nextStatuses = STATUS_FLOW[order.status] || [];

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className="card p-4 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onView(order)}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-gray-400">#{order.id}</span>
          <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
            {order.customer_name}
          </h4>
        </div>
        <span className={`status-badge status-${order.status}`}>
          {order.status}
        </span>
      </div>

      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-gray-400" />
          <span>{order.device_brand} {order.device_model}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-gray-400" />
          <span>{order.customer_phone}</span>
        </div>
        {order.technician_name && (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span>{order.technician_name}</span>
          </div>
        )}
        {order.estimated_completion_time && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>预计: {formatTime(order.estimated_completion_time)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 line-clamp-2">
          {order.fault_description}
        </p>
      </div>

      {nextStatuses.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {nextStatuses.map(status => (
              <button
                key={status}
                onClick={() => onUpdateStatus(order.id, status)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  status === '已取消'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                <ArrowRight className="w-3 h-3" />
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {order.quote !== undefined && order.quote !== null && (
          <span className="text-sm font-semibold text-green-600">¥{order.quote.toFixed(2)}</span>
        )}
        {order.quote === undefined || order.quote === null ? (
          <span className="text-xs text-gray-400">未报价</span>
        ) : null}
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
      </div>
    </div>
  );
}
