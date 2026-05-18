import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReturnStore } from '../store/returnStore';
import { ReturnStatus, ReturnStatusLabels } from '../../shared/types';
import { Plus, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { applications, stats, total, page, fetchApplications, fetchStats, loading, setPage } = useReturnStore();
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchApplications(statusFilter || undefined);
  }, [fetchApplications, statusFilter, page]);

  const getStatusColor = (status: ReturnStatus) => {
    const colors: Record<ReturnStatus, string> = {
      [ReturnStatus.DRAFT]: 'bg-gray-100 text-gray-800',
      [ReturnStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [ReturnStatus.APPROVED]: 'bg-green-100 text-green-800',
      [ReturnStatus.REJECTED]: 'bg-red-100 text-red-800',
      [ReturnStatus.OWNERSHIP_ISSUE]: 'bg-orange-100 text-orange-800',
      [ReturnStatus.PROCESSING]: 'bg-blue-100 text-blue-800',
      [ReturnStatus.STORED]: 'bg-teal-100 text-teal-800',
      [ReturnStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800',
      [ReturnStatus.ISSUE_RECORDED]: 'bg-purple-100 text-purple-800'
    };
    return colors[status];
  };

  const statCards = stats ? [
    { label: '待审核', value: stats.pending, color: 'bg-yellow-50 border-yellow-200' },
    { label: '归属不清', value: stats.ownershipIssue, color: 'bg-orange-50 border-orange-200' },
    { label: '处理中', value: stats.processing, color: 'bg-blue-50 border-blue-200' },
    { label: '已完成', value: stats.completed, color: 'bg-emerald-50 border-emerald-200' }
  ] : [];

  const filteredApplications = applications.filter(app =>
    app.teamName.includes(searchTerm) ||
    app.responsiblePerson.includes(searchTerm) ||
    app.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-8 px-6 mb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">博物馆讲解组讲解器归还管理系统</h1>
          <p className="text-blue-200">统一口径，规范流程，设备归属清晰可追溯</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8">
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {statCards.map((card, index) => (
              <div
                key={index}
                className={`${card.color} border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="text-3xl font-bold text-gray-800 mb-2">{card.value}</div>
                <div className="text-sm text-gray-600">{card.label}</div>
              </div>
            ))}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="text-3xl font-bold text-gray-800 mb-2">{stats.total}</div>
              <div className="text-sm text-gray-600">总申请数</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="text-3xl font-bold text-gray-800 mb-2">{stats.totalDevices}</div>
              <div className="text-sm text-gray-600">总设备数</div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <h2 className="text-xl font-semibold text-gray-800">归还申请列表</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索申请单号、讲解组、负责人..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ReturnStatus || '')}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部状态</option>
                  {Object.entries(ReturnStatusLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={() => navigate('/apply')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新建申请
                </button>
                <button
                  onClick={() => navigate('/export')}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-900 border border-blue-900 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  导出数据
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申请单号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">讲解组名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">负责人</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">设备数量</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">归还日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">问题</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">加载中...</td>
                  </tr>
                ) : filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">暂无数据</td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-blue-600">{app.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{app.teamName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{app.responsiblePerson}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{app.deviceCount}台</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{app.returnDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(app.status)}`}>
                          {ReturnStatusLabels[app.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {app.validationIssues.length > 0 ? (
                          <span className="text-red-600 font-medium">{app.validationIssues.length}个</span>
                        ) : (
                          <span className="text-green-600">无</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/review/${app.id}`)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          查看
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                共 {total} 条记录，第 {page} / {totalPages} 页
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
