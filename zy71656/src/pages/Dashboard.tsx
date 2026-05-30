import { useEffect } from 'react';
import {
  Users,
  BookOpen,
  FileText,
  ArrowLeftRight,
  FileSpreadsheet,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import { useStore } from '../store/useStore.js';

const statCards = [
  { key: 'totalAuthors', label: '作者数量', icon: Users, color: 'bg-blue-500' },
  { key: 'totalBooks', label: '图书数量', icon: BookOpen, color: 'bg-green-500' },
  { key: 'totalSalesRecords', label: '销售记录', icon: FileText, color: 'bg-purple-500' },
  { key: 'totalReturnRecords', label: '退货记录', icon: ArrowLeftRight, color: 'bg-orange-500' },
  { key: 'totalSettlements', label: '结算批次', icon: FileSpreadsheet, color: 'bg-cyan-500' },
  { key: 'pendingExceptions', label: '待处理异常', icon: AlertTriangle, color: 'bg-red-500' },
];

export default function Dashboard() {
  const { dashboard, loadDashboard } = useStore();

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">仪表盘</h2>
        <p className="text-gray-500 mt-1">版税结算系统概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = dashboard?.[card.key as keyof typeof dashboard] as number;
          return (
            <div
              key={card.key}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {value ?? '-'}
                  </p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="text-white" size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-50 p-2 rounded-lg">
              <DollarSign className="text-emerald-600" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">累计结算金额</h3>
          </div>
          <p className="text-4xl font-bold text-emerald-600">
            ¥{dashboard?.totalSettledAmount?.toLocaleString('zh-CN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) || '0.00'}
          </p>
          <p className="text-sm text-gray-500 mt-2">已锁定/已完成的结算</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">最近结算</h3>
          {dashboard?.settlements && dashboard.settlements.length > 0 ? (
            <div className="space-y-3">
              {dashboard.settlements.slice(0, 5).map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {settlement.period}
                    </p>
                    <p className="text-sm text-gray-500">
                      {settlement.itemCount} 条明细
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">
                      ¥{settlement.totalAmount.toLocaleString('zh-CN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        settlement.status === 'LOCKED'
                          ? 'bg-gray-100 text-gray-600'
                          : settlement.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-yellow-100 text-yellow-600'
                      }`}
                    >
                      {settlement.status === 'LOCKED'
                        ? '已锁定'
                        : settlement.status === 'COMPLETED'
                        ? '已完成'
                        : '处理中'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">暂无结算记录</p>
          )}
        </div>
      </div>
    </div>
  );
}
