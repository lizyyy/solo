import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Package, Truck, Ticket, Clock, Lock, CheckCircle } from 'lucide-react';
import { exceptionApi } from '../services/api';
import type { OrderException, ExceptionType } from '../types';
import { EXCEPTION_TYPE_LABELS, STATUS_LABELS } from '../types';

const exceptionIcons: Record<ExceptionType, any> = {
  INVENTORY_FAILURE: Package,
  LOGISTICS_CANCEL: Truck,
  DISCOUNT_EXCEPTION: Ticket
};

const exceptionColors: Record<ExceptionType, string> = {
  INVENTORY_FAILURE: 'bg-danger-50 text-danger-700 border-danger-200',
  LOGISTICS_CANCEL: 'bg-warning-50 text-warning-700 border-warning-200',
  DISCOUNT_EXCEPTION: 'bg-primary-50 text-primary-700 border-primary-200'
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

export default function ExceptionList() {
  const navigate = useNavigate();
  const [exceptions, setExceptions] = useState<OrderException[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await exceptionApi.getList();
      setExceptions(data);
    } catch (error) {
      console.error('获取异常订单列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredExceptions = exceptions.filter((e) => {
    if (filter === 'ALL') return true;
    return e.status === filter;
  });

  const pendingCount = exceptions.filter((e) => e.status === 'PENDING').length;
  const resolvedCount = exceptions.filter((e) => e.status === 'RESOLVED').length;

  if (loading && exceptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">全部异常</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{exceptions.length}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-3xl font-bold text-danger-600 mt-1">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-danger-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已完成</p>
              <p className="text-3xl font-bold text-success-600 mt-1">{resolvedCount}</p>
            </div>
            <div className="w-12 h-12 bg-success-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">异常订单列表</h3>
          <div className="flex items-center gap-2">
            {(['ALL', 'PENDING', 'RESOLVED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'ALL' ? '全部' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  订单信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  异常类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金额
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  锁定状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExceptions.map((exception) => {
                const Icon = exceptionIcons[exception.exception_type];
                const color = exceptionColors[exception.exception_type];

                return (
                  <tr
                    key={exception.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/exceptions/${exception.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{exception.order_no}</div>
                      <div className="text-sm text-gray-500">{exception.user_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${color}`}
                      >
                        <Icon className="w-4 h-4" />
                        {EXCEPTION_TYPE_LABELS[exception.exception_type]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {formatAmount(exception.total_amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          exception.status === 'PENDING'
                            ? 'bg-warning-100 text-warning-700'
                            : 'bg-success-100 text-success-700'
                        }`}
                      >
                        {exception.status === 'PENDING' ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        {STATUS_LABELS[exception.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {exception.locked_by ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                          <Lock className="w-3 h-3" />
                          已锁定 ({exception.operator_name})
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">未锁定</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {formatDate(exception.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/exceptions/${exception.id}`);
                        }}
                      >
                        查看详情
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredExceptions.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">暂无异常订单</p>
          </div>
        )}
      </div>
    </div>
  );
}
