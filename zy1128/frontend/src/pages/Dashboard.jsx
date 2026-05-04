import React from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  getMatchingStats,
  getProducts,
  getTransactions,
  getReconciliations,
  calculateExpectedPayouts,
  runAutoMatching,
  generateAllocations
} from '../services/api';
import { formatCurrency, getStatusLabel, getStatusBadgeClass } from '../utils/format';

function StatCard({ title, value, icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <div className={`card p-6 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();

  const { data: matchingStats } = useQuery('matchingStats', () => getMatchingStats());
  const { data: products } = useQuery('products', () => getProducts());
  const { data: transactions } = useQuery('transactions', () => getTransactions());
  const { data: reconciliations } = useQuery('reconciliations', () => getReconciliations());

  const calculateMutation = useMutation(calculateExpectedPayouts, {
    onSuccess: () => {
      queryClient.invalidateQueries('matchingStats');
      queryClient.invalidateQueries('reconciliations');
    },
  });

  const matchMutation = useMutation(runAutoMatching, {
    onSuccess: () => {
      queryClient.invalidateQueries('matchingStats');
      queryClient.invalidateQueries('reconciliations');
    },
  });

  const allocationMutation = useMutation(generateAllocations, {
    onSuccess: () => {
      queryClient.invalidateQueries('allocations');
    },
  });

  const handleCalculate = () => {
    calculateMutation.mutate();
  };

  const handleMatch = () => {
    matchMutation.mutate();
  };

  const handleAllocate = () => {
    allocationMutation.mutate();
  };

  const stats = matchingStats?.data || {};
  const totalPayouts = Object.values(stats).reduce((a, b) => a + b, 0);

  const recentReconciliations = (reconciliations?.data || []).slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">仪表板</h1>
        <p className="text-gray-500 mt-1">快速查看理财收益核对状态和操作入口</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="产品总数"
          value={products?.data?.length || 0}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="交易记录"
          value={transactions?.data?.length || 0}
          icon="📄"
          color="purple"
        />
        <StatCard
          title="核对记录"
          value={reconciliations?.data?.length || 0}
          icon="✅"
          color="green"
        />
        <StatCard
          title="应到账计划"
          value={totalPayouts}
          icon="💰"
          color="yellow"
        />
      </div>

      {totalPayouts > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="已匹配"
            value={stats.matched || 0}
            icon="✅"
            color="green"
          />
          <StatCard
            title="未到账"
            value={stats.unmatched || 0}
            icon="❌"
            color="red"
          />
          <StatCard
            title="少到账"
            value={stats.underpaid || 0}
            icon="⚠️"
            color="yellow"
          />
          <StatCard
            title="多到账"
            value={stats.overpaid || 0}
            icon="📈"
            color="purple"
          />
          <StatCard
            title="待处理"
            value={stats.pending || 0}
            icon="⏳"
            color="gray"
          />
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCalculate}
            disabled={calculateMutation.isLoading}
            className="btn btn-primary"
          >
            {calculateMutation.isLoading ? '计算中...' : '📊 计算应到账计划'}
          </button>
          <button
            onClick={handleMatch}
            disabled={matchMutation.isLoading}
            className="btn btn-success"
          >
            {matchMutation.isLoading ? '匹配中...' : '🔗 自动匹配流水'}
          </button>
          <button
            onClick={handleAllocate}
            disabled={allocationMutation.isLoading}
            className="btn btn-secondary"
          >
            {allocationMutation.isLoading ? '分摊中...' : '👥 生成分摊记录'}
          </button>
        </div>

        {(calculateMutation.isError || matchMutation.isError || allocationMutation.isError) && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              操作出错: {calculateMutation.error?.message || matchMutation.error?.message || allocationMutation.error?.message}
            </p>
          </div>
        )}

        {calculateMutation.isSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">
              计算完成！生成了 {calculateMutation.data?.data?.generatedCount || 0} 条应到账计划
            </p>
          </div>
        )}

        {matchMutation.isSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">
              匹配完成！匹配 {matchMutation.data?.data?.matchedCount || 0} 条，未匹配 {matchMutation.data?.data?.unmatchedCount || 0} 条
            </p>
          </div>
        )}

        {allocationMutation.isSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">
              分摊完成！生成了 {allocationMutation.data?.data?.generatedCount || 0} 条分摊记录
            </p>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">最近核对记录</h2>
        {recentReconciliations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">产品</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">持有人</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">应到账</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">实际到账</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">差额</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {recentReconciliations.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.product_name || '-'}</p>
                        <p className="text-xs text-gray-500">{formatDate(item.payout_date)}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.holder_name || '-'}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {formatCurrency(item.expected_amount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatCurrency(item.actual_amount)}
                    </td>
                    <td className={`py-3 px-4 text-sm font-medium ${
                      (item.difference || 0) < 0 ? 'text-red-600' : 
                      (item.difference || 0) > 0 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {formatCurrency(item.difference)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${getStatusBadgeClass(item.difference_type)}`}>
                        {getStatusLabel(item.difference_type)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-3">📋</p>
            <p>暂无核对记录</p>
            <p className="text-sm mt-1">请先导入数据并进行匹配</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
