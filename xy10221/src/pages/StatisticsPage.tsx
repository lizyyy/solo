import { useEffect, useState } from 'react';
import { storageService } from '../services/storage';
import { StatusBadge } from '../components/StatusBadge';
import type { Statistics, ExchangeRequest, ExchangeStatus, ValidationStatus } from '../types';
import { BarChart3, Users, CheckCircle, XCircle, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';

export function StatisticsPage() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const reqs = storageService.getExchangeRequests();
    setRequests(reqs);

    const stats: Statistics = {
      totalRequests: reqs.length,
      byStatus: {
        pending_validation: 0,
        validation_passed: 0,
        validation_failed: 0,
        inventory_checking: 0,
        inventory_available: 0,
        inventory_unavailable: 0,
        processing: 0,
        shipped: 0,
        completed: 0,
        cancelled: 0,
      },
      byUniformType: { 夏装: 0, 秋装: 0, 冬装: 0, 礼服: 0 },
      byValidationStatus: { passed: 0, failed: 0, retry: 0 },
      pendingManualReview: 0,
    };

    reqs.forEach((req) => {
      stats.byStatus[req.status] = (stats.byStatus[req.status] || 0) + 1;
      stats.byUniformType[req.uniformType] = (stats.byUniformType[req.uniformType] || 0) + 1;
      
      if (req.currentValidationResult) {
        stats.byValidationStatus[req.currentValidationResult.overallStatus] = 
          (stats.byValidationStatus[req.currentValidationResult.overallStatus] || 0) + 1;
        
        if (req.currentValidationResult.needsManualReview) {
          stats.pendingManualReview++;
        }
      }
    });

    setStatistics(stats);
  };

  if (!statistics) return <div>加载中...</div>;

  const classes = storageService.getClasses();
  const classStats = classes.map(cls => {
    const classRequests = requests.filter(r => r.classId === cls.id);
    const passed = classRequests.filter(r => r.currentValidationResult?.overallStatus === 'passed').length;
    const failed = classRequests.filter(r => r.currentValidationResult?.overallStatus === 'failed').length;
    const retry = classRequests.filter(r => r.currentValidationResult?.overallStatus === 'retry').length;
    return { ...cls, total: classRequests.length, passed, failed, retry };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">统计报表</h2>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">总申请数</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{statistics.totalRequests}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">验证通过</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{statistics.byValidationStatus.passed}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">可重试</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{statistics.byValidationStatus.retry}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">需人工处理</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{statistics.pendingManualReview}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">按状态分布</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {Object.entries(statistics.byStatus).map(([status, count]) => {
                if (count === 0) return null;
                const percentage = statistics.totalRequests > 0 ? (count / statistics.totalRequests * 100).toFixed(1) : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={status as ExchangeStatus} type="exchange" />
                      <span className="text-sm text-gray-600">{count} 条 ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">按服装类型分布</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {Object.entries(statistics.byUniformType).map(([type, count]) => {
                if (count === 0) return null;
                const percentage = statistics.totalRequests > 0 ? (count / statistics.totalRequests * 100).toFixed(1) : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{type}</span>
                      <span className="text-sm text-gray-600">{count} 条 ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">按班级统计</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">班级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">班主任</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总申请数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">通过</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">可重试</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">失败</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">通过率</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classStats.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cls.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cls.teacherName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cls.total}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      {cls.passed}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-sm text-yellow-600">
                      <AlertCircle className="w-4 h-4" />
                      {cls.retry}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-sm text-red-600">
                      <XCircle className="w-4 h-4" />
                      {cls.failed}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {cls.total > 0 ? `${(cls.passed / cls.total * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">库存概览</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['夏装', '秋装', '冬装', '礼服'].map((type) => {
              const items = storageService.getInventory().filter(i => i.uniformType === type);
              const total = items.reduce((sum, i) => sum + i.quantity, 0);
              return (
                <div key={type} className="p-4 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">{type}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
                  <p className="text-xs text-gray-500 mt-1">总库存</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
