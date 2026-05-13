import { useEffect, useState } from 'react';
import { dashboardApi } from '../services/api';
import { DashboardStats, Distribution } from '../types';

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, recentRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getRecent()
      ]);
      setStats(statsRes.data);
      setRecent(recentRes.data);
    } catch (error) {
      console.error('加载数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      distributed: 'status-distributed',
      pending: 'status-pending',
      blocked: 'status-blocked',
      returned: 'status-returned',
    };
    return classes[status] || '';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      distributed: '已发放',
      pending: '待审核',
      blocked: '已拦截',
      returned: '已退回',
    };
    return texts[status] || status;
  };

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">发放看板</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">家庭总数</p>
              <p className="text-3xl font-bold text-gray-800">{stats?.families.total}</p>
            </div>
            <div className="text-4xl">👨‍👩‍👧‍👦</div>
          </div>
          <div className="mt-4 flex gap-4">
            <div>
              <span className="text-green-600 font-medium">{stats?.families.approved}</span>
              <span className="text-gray-500 text-sm ml-1">已审核</span>
            </div>
            <div>
              <span className="text-yellow-600 font-medium">{stats?.families.pending}</span>
              <span className="text-gray-500 text-sm ml-1">待审核</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">发放总数</p>
              <p className="text-3xl font-bold text-gray-800">{stats?.distributions.total}</p>
            </div>
            <div className="text-4xl">📦</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <div>
              <span className="text-green-600 font-medium">{stats?.distributions.distributed}</span>
              <span className="text-gray-500 text-sm ml-1">已发放</span>
            </div>
            <div>
              <span className="text-yellow-600 font-medium">{stats?.distributions.pending}</span>
              <span className="text-gray-500 text-sm ml-1">待审核</span>
            </div>
            <div>
              <span className="text-red-600 font-medium">{stats?.distributions.blocked}</span>
              <span className="text-gray-500 text-sm ml-1">被拦截</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">库存总量</p>
              <p className="text-3xl font-bold text-gray-800">{stats?.inventory.total}</p>
            </div>
            <div className="text-4xl">🏪</div>
          </div>
          <div className="mt-4 flex gap-4">
            <div>
              <span className="text-blue-600 font-medium">{stats?.inventory.available}</span>
              <span className="text-gray-500 text-sm ml-1">可用</span>
            </div>
            <div>
              <span className="text-orange-600 font-medium">{stats?.inventory.distributed}</span>
              <span className="text-gray-500 text-sm ml-1">已发放</span>
            </div>
          </div>
        </div>
      </div>

      {stats?.distributions.needReview > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-yellow-800">有 {stats.distributions.needReview} 条记录需要人工复核</p>
              <p className="text-sm text-yellow-600">代领缺证明、周期边缘领取等情况需要人工确认</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">最近发放记录</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-600">发放编号</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">家庭</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">物资</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">数量</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">时间</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{item.distributionNo}</td>
                  <td className="py-3 px-4">{item.familyName}</td>
                  <td className="py-3 px-4">{item.materialName}</td>
                  <td className="py-3 px-4">{item.quantity}</td>
                  <td className="py-3 px-4">
                    <span className={`status-badge ${getStatusClass(item.status)}`}>
                      {getStatusText(item.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
