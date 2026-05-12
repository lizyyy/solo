import React, { useState } from 'react';
import { Search, Filter, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRepairStore } from '../store';
import { RepairStatus, statusLabels } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const OrderList: React.FC = () => {
  const { orders, searchOrders } = useRepairStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RepairStatus | 'all'>('all');

  const filteredOrders = searchTerm ? searchOrders(searchTerm) : orders;
  const finalOrders = statusFilter === 'all' 
    ? filteredOrders 
    : filteredOrders.filter(o => o.status === statusFilter);

  const sortedOrders = [...finalOrders].sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">维修单列表</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索订单号、客户姓名、电话、首饰名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RepairStatus | 'all')}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部状态</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">订单号</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">客户</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">首饰</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">状态</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">登记日期</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">预计取件</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <span className="font-medium text-blue-600">{order.orderNo}</span>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-800">{order.customerName}</p>
                    <p className="text-sm text-gray-500">{order.customerPhone}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-800">{order.jewelryName}</p>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{order.jewelryDescription}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {format(new Date(order.registeredAt), 'yyyy-MM-dd', { locale: zhCN })}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {order.estimatedPickupDate
                    ? format(new Date(order.estimatedPickupDate), 'yyyy-MM-dd', { locale: zhCN })
                    : '-'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Eye className="w-5 h-5 text-gray-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">暂无订单</p>
          </div>
        )}
      </div>
    </div>
  );
};
