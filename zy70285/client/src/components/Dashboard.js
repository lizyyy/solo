import { useState, useEffect } from 'react';
import { API_BASE, STATUS_CONFIG } from '../App';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard/stats`)
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">📊 系统概览</h2>
        <p className="text-gray-600 text-sm">实时追踪门店巡店、整改复查和总部评分的完整业务链</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">门店总数</div>
          <div className="text-3xl font-bold text-gray-800">{stats.stores}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-500 mb-1">问题总数</div>
          <div className="text-3xl font-bold text-gray-800">{stats.problems}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">已完成</div>
          <div className="text-3xl font-bold text-green-600">{stats.byStatus.completed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="text-sm text-gray-500 mb-1">待处理</div>
          <div className="text-3xl font-bold text-red-600">{stats.byStatus.pending}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">🔄 业务状态流转</h3>
          <div className="space-y-4">
            {[
              { from: '门店建档', to: '巡店记录', desc: '门店状态需为激活且已授权' },
              { from: '巡店记录', to: '问题生成', desc: '照片完整、问题描述规范才能通过验证' },
              { from: '问题生成', to: '整改提交', desc: '整改照片与原始问题对比验证' },
              { from: '整改提交', to: '复查通过', desc: '复查意见完整，整改数据一致性校验' }
            ].map((step, i) => (
              <div key={i} className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm mr-3">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-800">{step.from}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-blue-600">{step.to}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">🎯 验收标准</h3>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <div className="flex items-center space-x-2">
                <span className="text-green-600">✓</span>
                <span className="font-medium text-green-800">正常处理（通过）</span>
              </div>
              <p className="text-sm text-green-700 mt-1">验证 passed=true，score≥80，无 errors</p>
            </div>
            <div className="p-3 bg-red-50 rounded border border-red-200">
              <div className="flex items-center space-x-2">
                <span className="text-red-600">❌</span>
                <span className="font-medium text-red-800">失败原因</span>
              </div>
              <p className="text-sm text-red-700 mt-1">验证 passed=false，errors 数组包含具体原因</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
              <div className="flex items-center space-x-2">
                <span className="text-yellow-600">🔄</span>
                <span className="font-medium text-yellow-800">修正后重跑</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">存在 warnings，或修正 errors 后重新验证</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">📋 问题状态分布</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
            return (
              <div key={status} className="text-center p-4 rounded-lg bg-gray-50">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                  {config.label}
                </span>
                <div className="text-2xl font-bold mt-2 text-gray-800">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
