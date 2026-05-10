import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storage';
import { StatusBadge } from '../components/StatusBadge';
import type { ExchangeRequest, ExchangeStatus, UniformType, ValidationStatus } from '../types';
import { Search, Filter, Download, Eye, RefreshCw, Trash2 } from 'lucide-react';

const statusLabels: Record<ExchangeStatus, string> = {
  pending_validation: '待验证',
  validation_passed: '验证通过',
  validation_failed: '验证失败',
  inventory_checking: '库存检查中',
  inventory_available: '库存充足',
  inventory_unavailable: '库存不足',
  processing: '处理中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

const validationLabels: Record<ValidationStatus, string> = {
  passed: '通过',
  failed: '失败',
  retry: '可重试',
};

export function RequestsListPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);
  const [filters, setFilters] = useState({
    classId: '',
    status: '',
    uniformType: '',
    validationStatus: '',
    keyword: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setRequests(storageService.getExchangeRequests());
  };

  const filteredRequests = requests.filter((req) => {
    if (filters.classId && req.classId !== filters.classId) return false;
    if (filters.status && req.status !== filters.status) return false;
    if (filters.uniformType && req.uniformType !== filters.uniformType) return false;
    if (filters.validationStatus && req.currentValidationResult?.overallStatus !== filters.validationStatus) return false;
    if (filters.keyword) {
      const student = storageService.getStudentById(req.studentId);
      const keyword = filters.keyword.toLowerCase();
      return (
        student?.name.toLowerCase().includes(keyword) ||
        req.reason.toLowerCase().includes(keyword) ||
        req.id.toLowerCase().includes(keyword)
      );
    }
    return true;
  });

  const exportToCSV = () => {
    const headers = ['申请ID', '学生', '班级', '服装类型', '原尺码', '申请尺码', '状态', '验证状态', '创建时间', '创建人'];
    const rows = filteredRequests.map((req) => {
      const student = storageService.getStudentById(req.studentId);
      const classInfo = storageService.getClassById(req.classId);
      return [
        req.id,
        student?.name || '未知',
        classInfo?.name || '未知',
        req.uniformType,
        req.originalSize,
        req.requestedSize,
        statusLabels[req.status],
        req.currentValidationResult ? validationLabels[req.currentValidationResult.overallStatus] : '未验证',
        req.createdAt,
        req.createdBy,
      ];
    });

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `换领申请_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const resetData = () => {
    if (window.confirm('确定要重置所有数据吗？这将恢复到初始状态。')) {
      storageService.resetData();
      loadData();
      alert('数据已重置');
    }
  };

  const classes = storageService.getClasses();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">换领申请列表</h2>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={resetData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            <Trash2 className="w-4 h-4" />
            重置数据
          </button>
          <Link
            to="/requests/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            新建申请
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索学生姓名、申请原因..."
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              筛选
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">班级</label>
                <select
                  value={filters.classId}
                  onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申请状态</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服装类型</label>
                <select
                  value={filters.uniformType}
                  onChange={(e) => setFilters({ ...filters, uniformType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部</option>
                  <option value="夏装">夏装</option>
                  <option value="秋装">秋装</option>
                  <option value="冬装">冬装</option>
                  <option value="礼服">礼服</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">验证状态</label>
                <select
                  value={filters.validationStatus}
                  onChange={(e) => setFilters({ ...filters, validationStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部</option>
                  {Object.entries(validationLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学生</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">班级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">服装类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">尺码变化</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申请状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">验证状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">重试次数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    暂无换领申请记录
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const student = storageService.getStudentById(req.studentId);
                  const classInfo = storageService.getClassById(req.classId);
                  return (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{student?.name || '未知'}</div>
                        <div className="text-sm text-gray-500">{student?.studentNo || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {classInfo?.name || '未知'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {req.uniformType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="text-gray-500">{req.originalSize}</span>
                        <span className="mx-2">→</span>
                        <span className="font-medium">{req.requestedSize}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={req.status} type="exchange" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {req.currentValidationResult ? (
                          <StatusBadge status={req.currentValidationResult.overallStatus} type="validation" />
                        ) : (
                          <span className="text-gray-400">未验证</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {req.retryCount} 次
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => navigate(`/requests/${req.id}`)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4" />
                          查看
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500">
            共 {filteredRequests.length} 条记录
          </p>
        </div>
      </div>
    </div>
  );
}
