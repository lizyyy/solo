import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Clock, 
  Wrench, 
  Users,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { dashboardAPI } from '../utils/api';
import dayjs from 'dayjs';

const STATUS_LABELS = {
  'pending_assignment': '待分派',
  'in_progress': '处理中',
  'pending_review': '待复核',
  'closed': '已关闭'
};

const PATROL_STATUS_LABELS = {
  'pending': '待开始',
  'in_progress': '进行中',
  'completed': '已完成'
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getOverview();
      setDashboardData(response.data);
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const { overview, workerLoads, recentRepairOrders } = dashboardData || {
    overview: {},
    workerLoads: [],
    recentRepairOrders: []
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
        <button 
          onClick={loadDashboardData}
          className="btn btn-secondary btn-sm"
        >
          刷新数据
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-title">本周异常率</p>
              <p className="stat-card-value">
                <span className={overview.abnormalRate > 30 ? 'text-red-600' : 'text-green-600'}>
                  {overview.abnormalRate || 0}%
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                巡检 {overview.thisWeekPatrolCount || 0} 次，异常 {overview.thisWeekAbnormalCount || 0} 次
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <AlertTriangle className="text-amber-600" size={24} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-title">逾期工单数</p>
              <p className="stat-card-value">
                <span className={overview.overdueCount > 0 ? 'text-red-600' : 'text-green-600'}>
                  {overview.overdueCount || 0}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                需尽快处理
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <Clock className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-title">维修单总数</p>
              <p className="stat-card-value">{overview.totalRepairOrders || 0}</p>
              <div className="flex gap-2 mt-1">
                {Object.entries(overview.byStatus || {}).map(([status, count]) => (
                  <span key={status} className="text-sm text-gray-500">
                    {STATUS_LABELS[status]}: {count}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Wrench className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-title">在岗师傅</p>
              <p className="stat-card-value">{workerLoads.length}</p>
              <p className="text-sm text-gray-500 mt-1">
                平均待办: {workerLoads.length > 0 
                  ? Math.round(workerLoads.reduce((sum, w) => sum + w.activeTaskCount, 0) / workerLoads.length)
                  : 0} 单
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="text-green-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold">各师傅负载</h2>
            <Link to="/workers" className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1">
              查看全部 <ChevronRight size={16} />
            </Link>
          </div>
          <div className="card-body">
            {workerLoads.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无维修师傅数据</p>
            ) : (
              <div className="space-y-4">
                {workerLoads.map((worker) => (
                  <div key={worker.id} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-medium">
                        {worker.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{worker.name}</span>
                        <span className="text-sm text-gray-500">
                          {worker.activeTaskCount} 个待办
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              worker.activeTaskCount > 3 ? 'bg-red-500' : 
                              worker.activeTaskCount > 1 ? 'bg-amber-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(worker.activeTaskCount * 20, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {worker.totalEstimatedHours || 0} 小时
                        </span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {worker.skills.map((skill) => (
                          <span key={skill} className="badge bg-gray-100 text-gray-600">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold">最近维修单</h2>
            <Link to="/repair-orders" className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1">
              查看全部 <ChevronRight size={16} />
            </Link>
          </div>
          <div className="card-body">
            {recentRepairOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无维修单数据</p>
            ) : (
              <div className="space-y-3">
                {recentRepairOrders.map((order) => (
                  <Link 
                    key={order.id}
                    to={`/repair-orders/${order.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{order.title}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {order.device?.building?.name} - {order.device?.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm')}
                        </p>
                      </div>
                      <div className="ml-3">
                        <span className={`badge status-badge-${order.isOverdue ? 'overdue' : order.status}`}>
                          {order.isOverdue ? '已逾期' : order.statusLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">维修单状态分布</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(overview.byStatus || {}).map(([status, count]) => (
              <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-600 mt-1">{STATUS_LABELS[status] || status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
