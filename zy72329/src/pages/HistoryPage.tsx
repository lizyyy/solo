import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Clock, User, Search, Filter, Upload, GitBranch, FileCheck, GitMerge, ChevronDown, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import { OperationHistory, OperationType } from '../../shared/types';
import { cn } from '../lib/utils';

const operationIcons: Record<OperationType, typeof Upload> = {
  import: Upload,
  match: GitBranch,
  conflict_resolve: GitMerge,
  gap_review: FileCheck,
  version_create: GitBranch,
};

const operationLabels: Record<OperationType, string> = {
  import: '数据导入',
  match: '数据匹配',
  conflict_resolve: '冲突处理',
  gap_review: '断档复核',
  version_create: '版本创建',
};

const operationColors: Record<OperationType, string> = {
  import: 'bg-blue-100 text-blue-600',
  match: 'bg-purple-100 text-purple-600',
  conflict_resolve: 'bg-red-100 text-red-600',
  gap_review: 'bg-orange-100 text-orange-600',
  version_create: 'bg-green-100 text-green-600',
};

const roleLabels: Record<string, string> = {
  admin: '系统管理员',
  coach: '教练',
  reviewer: '审核员',
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const { histories, setHistories, setSelectedRecord, setDrawerOpen } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    recordId: '',
    operator: '',
    startDate: '',
    endDate: '',
    operationType: '',
  });
  const [selectedRecordHistory, setSelectedRecordHistory] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.recordId) params.recordId = filters.recordId;
      if (filters.operator) params.operator = filters.operator;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.operationType) params.operationType = filters.operationType;

      const data = await api.getHistory(params);
      setHistories(data);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, setHistories]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    loadHistory();
  };

  const handleReset = () => {
    setFilters({
      recordId: '',
      operator: '',
      startDate: '',
      endDate: '',
      operationType: '',
    });
  };

  const handleViewRecord = async (recordId: string) => {
    try {
      const record = await api.getRecordDetail(recordId);
      setSelectedRecord(record);
      setDrawerOpen(true);
      setSelectedRecordHistory(recordId);
    } catch (error) {
      console.error('加载记录详情失败:', error);
    }
  };

  const handleJumpToRecord = (recordId: string) => {
    navigate('/');
    setTimeout(() => {
      handleViewRecord(recordId);
    }, 100);
  };

  const groupedByDate = histories.reduce((acc, item) => {
    const date = item.createdAt.split(' ')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, OperationHistory[]>);

  const getRecordLifecycle = (recordId: string) => {
    return histories
      .filter((h) => h.recordId === recordId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">历史记录</h1>
          <p className="text-sm text-gray-500 mt-1">查看所有操作日志和记录生命周期</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div
          className="px-6 py-4 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-700">筛选条件</span>
          </div>
          <ChevronDown className={cn(
            'w-5 h-5 text-gray-400 transition-transform',
            filterOpen && 'rotate-180'
          )} />
        </div>

        {filterOpen && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  记录ID
                </label>
                <input
                  type="text"
                  value={filters.recordId}
                  onChange={(e) => handleFilterChange('recordId', e.target.value)}
                  placeholder="输入记录ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作人
                </label>
                <input
                  type="text"
                  value={filters.operator}
                  onChange={(e) => handleFilterChange('operator', e.target.value)}
                  placeholder="输入操作人姓名"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作类型
                </label>
                <select
                  value={filters.operationType}
                  onChange={(e) => handleFilterChange('operationType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                >
                  <option value="">全部类型</option>
                  {(Object.keys(operationLabels) as OperationType[]).map((type) => (
                    <option key={type} value={type}>{operationLabels[type]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  开始日期
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  结束日期
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                搜索
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                重置
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          加载中...
        </div>
      ) : histories.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无操作记录</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-700">{date}</h2>
              </div>

              <div className="relative pl-10">
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

                <div className="space-y-4">
                  {items.map((item) => {
                    const Icon = operationIcons[item.operationType];
                    const isRecordSelected = selectedRecordHistory === item.recordId;
                    const lifecycle = item.recordId ? getRecordLifecycle(item.recordId) : [];

                    return (
                      <div key={item.id} className="relative">
                        <div
                          className={cn(
                            'absolute -left-7 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center z-10',
                            operationColors[item.operationType]
                          )}
                        >
                          <Icon className="w-3 h-3" />
                        </div>

                        <div
                          className={cn(
                            'bg-white border rounded-xl p-4 transition-all cursor-pointer',
                            isRecordSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                          )}
                          onClick={() => item.recordId && handleViewRecord(item.recordId)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium',
                                  operationColors[item.operationType]
                                )}>
                                  {operationLabels[item.operationType]}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">
                                  {item.createdAt.split(' ')[1]}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800">{item.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {item.operator}
                                  <span className="text-gray-400">({roleLabels[item.operatorRole] || item.operatorRole})</span>
                                </span>
                                {item.recordId && (
                                  <span className="font-mono text-gray-400">
                                    ID: {item.recordId}
                                  </span>
                                )}
                              </div>
                            </div>
                            {item.recordId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJumpToRecord(item.recordId);
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                title="跳转到记录"
                              >
                                <ExternalLink className="w-4 h-4 text-gray-400" />
                              </button>
                            )}
                          </div>

                          {isRecordSelected && lifecycle.length > 1 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <h4 className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-1">
                                <GitBranch className="w-3 h-3" />
                                完整生命周期追溯
                              </h4>
                              <div className="relative pl-6">
                                <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-gray-200" />
                                <div className="space-y-3">
                                  {lifecycle.map((event, index) => {
                                    const EventIcon = operationIcons[event.operationType];
                                    const isLatest = index === lifecycle.length - 1;
                                    return (
                                      <div key={event.id} className="relative">
                                        <div
                                          className={cn(
                                            'absolute -left-5 w-4 h-4 rounded-full flex items-center justify-center z-10',
                                            isLatest ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                                          )}
                                        >
                                          <EventIcon className="w-2.5 h-2.5" />
                                        </div>
                                        <div className="p-2 bg-gray-50 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-gray-700">
                                              {operationLabels[event.operationType]}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-mono">
                                              {event.createdAt.split(' ')[1]}
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                                          <p className="text-[10px] text-gray-400 mt-0.5">
                                            {event.operator}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
