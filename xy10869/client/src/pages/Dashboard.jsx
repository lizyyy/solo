import React, { useState, useEffect } from 'react';
import { BarChart3, Database, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { migrationAPI } from '../services/api';

const Dashboard = () => {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const response = await migrationAPI.getStatistics();
      setStatistics(response.data.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusLabels = {
    pending: '待执行',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    waiting_confirmation: '待确认',
    confirmed: '已确认',
    rollback_required: '需回滚',
    rolled_back: '已回滚',
    compensated: '已补偿'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const overview = statistics?.overview || {};

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">总览</h1>
        <p className="text-gray-500 mt-1">数据库迁移预演系统概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">总批次</p>
              <p className="text-2xl font-bold text-gray-900">{overview.total_batches || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">已完成</p>
              <p className="text-2xl font-bold text-gray-900">{overview.completed || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">失败</p>
              <p className="text-2xl font-bold text-gray-900">{overview.failed || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">执行中</p>
              <p className="text-2xl font-bold text-gray-900">{overview.running || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">状态分布</h2>
          <div className="space-y-3">
            {statistics?.byStatus?.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`status-badge status-${item.status}`}>
                    {statusLabels[item.status] || item.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${(item.count / (overview.total_batches || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-8 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">影响统计</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">总影响行数</p>
                <p className="text-xl font-bold text-gray-900">
                  {overview.total_affected_rows?.toLocaleString() || 0}
                </p>
              </div>
              <Database size={24} className="text-gray-400" />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">慢查询数量</p>
                <p className="text-xl font-bold text-gray-900">
                  {overview.total_slow_queries?.toLocaleString() || 0}
                </p>
              </div>
              <Clock size={24} className="text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
