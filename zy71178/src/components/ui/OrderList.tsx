import { Order } from '../../types/game';
import { formatTime } from '../../game/engine';
import { Package, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface OrderListProps {
  orders: Order[];
  currentTime: number;
}

const statusLabels: Record<Order['status'], string> = {
  pending: '待分配',
  in_progress: '进行中',
  completed: '已完成',
  timeout: '已超时',
};

const statusColors: Record<Order['status'], string> = {
  pending: 'text-gray-400',
  in_progress: 'text-blue-400',
  completed: 'text-green-400',
  timeout: 'text-red-400',
};

export function OrderList({ orders, currentTime }: OrderListProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <Package className="w-4 h-4" />
        订单列表
      </h3>
      
      {orders.length === 0 ? (
        <div className="text-center text-gray-500 py-4">
          暂无订单
        </div>
      ) : (
        orders.map((order) => {
          const timeRemaining = order.deadline - currentTime;
          const isUrgent = timeRemaining < 30 && order.status === 'pending';
          const pickedCount = order.items.filter((item) => item.picked).length;
          
          return (
            <div
              key={order.id}
              className={`p-3 rounded-lg border transition-all ${
                order.status === 'completed'
                  ? 'bg-green-900/20 border-green-700/50'
                  : order.status === 'timeout'
                  ? 'bg-red-900/20 border-red-700/50'
                  : isUrgent
                  ? 'bg-yellow-900/20 border-yellow-600/50 animate-pulse'
                  : 'bg-gray-800/50 border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {order.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : order.status === 'timeout' ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : order.status === 'in_progress' ? (
                    <Loader className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : (
                    <Package className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium text-white text-sm">
                    {order.id.toUpperCase()}
                  </span>
                </div>
                <span className={`text-xs ${statusColors[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>
                    剩余时间:{' '}
                    <span
                      className={
                        timeRemaining < 30 && order.status !== 'completed'
                          ? 'text-red-400 font-semibold'
                          : 'text-gray-300'
                      }
                    >
                      {formatTime(Math.max(0, timeRemaining))}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-400">进度:</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(pickedCount / order.items.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-300">
                    {pickedCount}/{order.items.length}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
