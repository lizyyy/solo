import React from 'react';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Package,
  DollarSign,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { useRepairStore } from '../store';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { getDashboardStats, getOverdueOrders, getUnquotedRepairingOrders } = useRepairStore();
  const stats = getDashboardStats();
  const overdueOrders = getOverdueOrders();
  const unquotedOrders = getUnquotedRepairingOrders();

  const statCards = [
    {
      label: '总订单数',
      value: stats.totalOrders,
      icon: ClipboardList,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: '进行中',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'bg-purple-50 text-purple-600'
    },
    {
      label: '维修中',
      value: stats.repairingOrders,
      icon: Package,
      color: 'bg-orange-50 text-orange-600'
    },
    {
      label: '今日完成',
      value: stats.completedToday,
      icon: CheckCircle2,
      color: 'bg-green-50 text-green-600'
    },
    {
      label: '今日取件',
      value: stats.pickedUpToday,
      icon: Package,
      color: 'bg-teal-50 text-teal-600'
    },
    {
      label: '总收入',
      value: `¥${stats.totalRevenue}`,
      icon: DollarSign,
      color: 'bg-yellow-50 text-yellow-600'
    }
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">仪表盘</h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(overdueOrders.length > 0 || unquotedOrders.length > 0) && (
        <div className="space-y-6 mb-8">
          {overdueOrders.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-red-800">逾期订单提醒</h2>
                <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full text-sm">
                  {overdueOrders.length} 单
                </span>
              </div>
              <div className="space-y-2">
                {overdueOrders.slice(0, 5).map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center justify-between bg-white rounded-lg p-3 hover:bg-red-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{order.orderNo}</p>
                      <p className="text-sm text-gray-500">
                        {order.customerName} - {order.jewelryName}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {unquotedOrders.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <h2 className="text-lg font-semibold text-yellow-800">未报价已维修提醒</h2>
                <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm">
                  {unquotedOrders.length} 单
                </span>
              </div>
              <p className="text-sm text-yellow-700 mb-4">
                以下订单已开始维修但客户未确认报价，请及时处理
              </p>
              <div className="space-y-2">
                {unquotedOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center justify-between bg-white rounded-lg p-3 hover:bg-yellow-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{order.orderNo}</p>
                      <p className="text-sm text-gray-500">
                        {order.customerName} - {order.jewelryName}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
