import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Edit, AlertTriangle, TrendingUp, Clock, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { useLimitStore } from '../store/limitStore';
import { StatusBadge, RiskBadge } from '../components/StatusBadge';
import { formatMoney, formatDateTime } from '../utils/format';
import { LimitStatus } from '../types';
import { cn } from '@/lib/utils';

export const LimitList: React.FC = () => {
  const navigate = useNavigate();
  const walletLimits = useLimitStore((state) => state.walletLimits);
  const getStatusCounts = useLimitStore((state) => state.getStatusCounts);
  const getRiskMarksByWalletId = useLimitStore((state) => state.getRiskMarksByWalletId);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LimitStatus | 'all'>('all');

  const statusCounts = getStatusCounts();

  const filteredLimits = useMemo(() => {
    return walletLimits.filter((limit) => {
      const matchesSearch =
        limit.walletAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
        limit.walletName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || limit.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [walletLimits, searchTerm, statusFilter]);

  const statusCards = [
    { status: 'pending' as const, label: '待处理', count: statusCounts.pending, icon: Clock, color: 'amber' },
    { status: 'processing' as const, label: '处理中', count: statusCounts.processing, icon: TrendingUp, color: 'blue' },
    { status: 'approved' as const, label: '已通过', count: statusCounts.approved, icon: CheckCircle, color: 'emerald' },
    { status: 'rejected' as const, label: '已拒绝', count: statusCounts.rejected, icon: XCircle, color: 'red' },
    { status: 'to_confirm' as const, label: '待确认', count: statusCounts.to_confirm, icon: HelpCircle, color: 'orange' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">数字钱包限额复核</h1>
        <p className="text-slate-500 mt-1">管理企业钱包日限额、单笔限额和临时白名单</p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        {statusCards.map((card) => {
          const Icon = card.icon;
          const colorClasses: Record<string, string> = {
            amber: 'bg-amber-50 border-amber-200 text-amber-600',
            blue: 'bg-blue-50 border-blue-200 text-blue-600',
            emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
            red: 'bg-red-50 border-red-200 text-red-600',
            orange: 'bg-orange-50 border-orange-200 text-orange-600',
          };
          const isSelected = statusFilter === card.status;
          return (
            <button
              key={card.status}
              onClick={() => setStatusFilter(isSelected ? 'all' : card.status)}
              className={cn(
                'p-4 rounded-xl border-2 transition-all text-left',
                colorClasses[card.color],
                isSelected ? 'ring-2 ring-offset-2 ring-slate-400' : 'hover:shadow-md'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5" />
                <span className="text-2xl font-bold">{card.count}</span>
              </div>
              <span className="text-sm font-medium">{card.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索钱包账户或名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="text-sm text-slate-500">共 {filteredLimits.length} 条记录</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  钱包账户
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  日限额
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  单笔限额
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  已用额度
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  风险
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLimits.map((limit) => {
                const riskMarks = getRiskMarksByWalletId(limit.id).filter((r) => !r.isResolved);
                const usagePercent = (limit.usedDailyLimit / limit.dailyLimit) * 100;
                return (
                  <tr key={limit.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-mono text-sm font-medium text-slate-900">
                          {limit.walletAccount}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{limit.walletName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-sm">{formatMoney(limit.dailyLimit)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-sm">{formatMoney(limit.singleLimit)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-sm">{formatMoney(limit.usedDailyLimit)}</div>
                      <div className="mt-1 w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            usagePercent >= 90
                              ? 'bg-red-500'
                              : usagePercent >= 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          )}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{usagePercent.toFixed(1)}%</div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={limit.status} size="sm" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={limit.riskLevel} size="sm" />
                        {riskMarks.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            {riskMarks.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500">
                      {formatDateTime(limit.updatedAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/detail/${limit.id}`)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/edit/${limit.id}`)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="修正限额"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLimits.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>没有找到匹配的记录</p>
          </div>
        )}
      </div>
    </div>
  );
};
