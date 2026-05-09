import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, Plus, Eye, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { requestsApi, exportApi } from '../api';
import { statusMap, type ReviewFilters, type ReviewStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import CreateModal from '../components/CreateModal';

function RequestList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [filters, setFilters] = useState<ReviewFilters>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['requests', page, pageSize, filters],
    queryFn: () => requestsApi.getList({ ...filters, page, pageSize }).then(res => res.data),
  });

  const handleSearch = useCallback(() => {
    setFilters(prev => ({ ...prev, keyword: searchKeyword }));
    setPage(1);
  }, [searchKeyword]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleStatusFilter = (status: ReviewStatus | undefined) => {
    setFilters(prev => ({ ...prev, status }));
    setPage(1);
  };

  const handleDateFilter = (start: string | undefined, end: string | undefined) => {
    setFilters(prev => ({ ...prev, startDate: start, endDate: end }));
    setPage(1);
  };

  const handleExport = () => {
    exportApi.exportCSV(filters);
  };

  const handleCreated = () => {
    setShowCreateModal(false);
    queryClient.invalidateQueries({ queryKey: ['requests'] });
    queryClient.invalidateQueries({ queryKey: ['report'] });
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">申请管理</h2>
          <p className="text-gray-500 text-sm mt-1">管理学员证书补发申请，进行审核和异常处理</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleExport} className="btn-secondary flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>导出数据</span>
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>新建申请</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleStatusFilter(undefined)}
          className={`badge cursor-pointer transition-colors ${!filters.status ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          全部 {data ? `(${data.total})` : ''}
        </button>
        <button
          onClick={() => handleStatusFilter('pending')}
          className={`badge cursor-pointer transition-colors ${filters.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <Clock className="w-3 h-3 mr-1" />
          待审核
        </button>
        <button
          onClick={() => handleStatusFilter('approved')}
          className={`badge cursor-pointer transition-colors ${filters.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          已通过
        </button>
        <button
          onClick={() => handleStatusFilter('rejected')}
          className={`badge cursor-pointer transition-colors ${filters.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <XCircle className="w-3 h-3 mr-1" />
          已拒绝
        </button>
        <button
          onClick={() => handleStatusFilter('abnormal')}
          className={`badge cursor-pointer transition-colors ${filters.status === 'abnormal' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <AlertCircle className="w-3 h-3 mr-1" />
          异常
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索申请编号、学员姓名、手机号..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="input pl-10"
              />
            </div>
            <button onClick={handleSearch} className="btn-primary">
              搜索
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center space-x-2 ${showFilters ? 'bg-gray-300' : ''}`}
            >
              <Filter className="w-4 h-4" />
              <span>高级筛选</span>
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申请时间从</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleDateFilter(e.target.value || undefined, filters.endDate)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">申请时间至</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleDateFilter(filters.startDate, e.target.value || undefined)}
                  className="input"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilters({});
                    setSearchKeyword('');
                  }}
                  className="btn-secondary w-full"
                >
                  重置筛选
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">加载数据失败</p>
            <button onClick={() => refetch()} className="btn-primary">
              重试
            </button>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>申请编号</th>
                  <th>学员信息</th>
                  <th>课程</th>
                  <th>补发原因</th>
                  <th>状态</th>
                  <th>申请时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      加载中...
                    </td>
                  </tr>
                ) : !data?.data.length ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  data.data.map((item) => (
                    <tr key={item.id} className="cursor-pointer">
                      <td onClick={() => navigate(`/requests/${item.id}`)}>
                        <span className="font-mono text-sm text-primary-600">{item.requestNo}</span>
                      </td>
                      <td onClick={() => navigate(`/requests/${item.id}`)}>
                        <div className="font-medium">{item.student.name}</div>
                        <div className="text-sm text-gray-500">{item.student.phone}</div>
                      </td>
                      <td onClick={() => navigate(`/requests/${item.id}`)}>
                        <div className="font-medium">{item.courseName}</div>
                        <div className="text-sm text-gray-500">{item.courseCode}</div>
                      </td>
                      <td onClick={() => navigate(`/requests/${item.id}`)} className="max-w-xs">
                        <div className="truncate">{item.reason}</div>
                      </td>
                      <td onClick={() => navigate(`/requests/${item.id}`)}>
                        <StatusBadge status={item.reviewStatus} />
                        {item.abnormalReason && (
                          <div className="text-xs text-orange-600 mt-1 truncate max-w-32">
                            {item.abnormalReason}
                          </div>
                        )}
                      </td>
                      <td onClick={() => navigate(`/requests/${item.id}`)}>
                        <div className="text-sm">{dayjs(item.createdAt).format('YYYY-MM-DD')}</div>
                        <div className="text-xs text-gray-500">{dayjs(item.createdAt).format('HH:mm')}</div>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/requests/${item.id}`)}
                          className="text-primary-600 hover:text-primary-700 inline-flex items-center space-x-1 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          <span>查看</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.total > pageSize && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                共 {data.total} 条，第 {page} / {totalPages} 页
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary px-3 py-1"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary px-3 py-1"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

export default RequestList;
