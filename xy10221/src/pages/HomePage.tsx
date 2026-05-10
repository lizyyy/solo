import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { storageService } from '../services/storage';
import { StatusBadge } from '../components/StatusBadge';
import type { ExchangeRequest, Statistics } from '../types';
import { FileText, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export function HomePage() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [recentRequests, setRecentRequests] = useState<ExchangeRequest[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const requests = storageService.getExchangeRequests();
    
    const stats: Statistics = {
      totalRequests: requests.length,
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

    requests.forEach((req) => {
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
    setRecentRequests(requests.slice(-5).reverse());
  };

  if (!statistics) return <div>加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">系统概览</h2>
        <div className="flex gap-3">
          <Link
            to="/requests/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FileText className="w-4 h-4" />
            新建申请
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">总申请数</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{statistics.totalRequests}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-500">验证通过</p>
          </div>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {statistics.byValidationStatus.passed}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-gray-500">可重试</p>
          </div>
          <p className="text-3xl font-bold text-yellow-600 mt-2">
            {statistics.byValidationStatus.retry}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-gray-500">需人工处理</p>
          </div>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {statistics.pendingManualReview}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">最近申请</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentRequests.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                暂无换领申请
              </div>
            ) : (
              recentRequests.map((req) => {
                const student = storageService.getStudentById(req.studentId);
                return (
                  <Link
                    key={req.id}
                    to={`/requests/${req.id}`}
                    className="block px-6 py-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {student?.name || '未知学生'} - {req.uniformType}
                        </p>
                        <p className="text-sm text-gray-500">
                          {req.originalSize} → {req.requestedSize}
                        </p>
                      </div>
                      <StatusBadge status={req.status} type="exchange" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">状态分布</h3>
          </div>
          <div className="p-6 space-y-3">
            {Object.entries(statistics.byStatus).map(([status, count]) => {
              if (count === 0) return null;
              return (
                <div key={status} className="flex items-center justify-between">
                  <StatusBadge status={status as any} type="exchange" />
                  <span className="text-sm text-gray-600">{count} 条</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800">快速参考</h3>
        <ul className="mt-2 text-sm text-blue-700 space-y-1">
          <li>• <strong>验证通过</strong>：所有校验项都通过，可以进入库存检查和处理流程</li>
          <li>• <strong>验证失败</strong>：存在无法自动修复的问题，需要人工处理</li>
          <li>• <strong>可重试</strong>：问题可以通过修正数据解决，修正后可重新验证</li>
          <li>• 详细的验收标准请查看 <Link to="/docs" className="underline font-medium">验收文档</Link></li>
        </ul>
      </div>
    </div>
  );
}
