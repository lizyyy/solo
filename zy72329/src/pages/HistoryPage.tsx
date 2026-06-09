import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Clock, User, Search, Filter, Upload, GitBranch, FileCheck, GitMerge, ChevronDown, ExternalLink, ArrowRight, Shield } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { useAppStore } from '../store';
import { OperationHistory, OperationType, RecordStatus } from '../../shared/types';
import { cn } from '../lib/utils';
import StatusBadge from '../components/StatusBadge';

const operationIcons: Record<OperationType, typeof Upload> = {
  import: Upload,
  match: GitBranch,
  conflict_resolve: GitMerge,
  gap_review: FileCheck,
  version_create: GitBranch,
};

const operationLabels: Record<OperationType, string> = {
  import: '数据导入',
  match: '匹配识别',
  conflict_resolve: '冲突处理',
  gap_review: '断档复核',
  version_create: '参数版本生成',
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
  coach: '唐老师',
  reviewer: '教研组',
};

const statusLabels: Record<string, string> = {
  smooth: '顺利记录',
  gap: '编号断档',
  supplement: '旧口径补录',
  conflict: '数据冲突',
  pending: '待处理',
  approved: '已通过',
  rejected: '已拒绝',
  reviewed_normal: '复核正常',
  reviewed_abnormal: '复核异常',
};

interface ParsedState {
  status?: RecordStatus;
  nextHandler?: string;
  reason?: string;
  resolution?: string;
  [key: string]: any;
}

function parseStateJson(state?: Record<string, any> | string): ParsedState {
  if (!state) return {};
  if (typeof state === 'object') {
    return state as ParsedState;
  }
  try {
    return JSON.parse(state) as ParsedState;
  } catch {
    return {};
  }
}

function getNextHandlerLabel(handler?: string): string {
  if (!handler) return '';
  if (handler === 'coach') return '唐老师';
  if (handler === 'reviewer') return '教研组';
  if (handler === 'admin') return '系统管理员';
  return handler;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { history, loading, refreshHistory, getRecordById, records } = useDataStore();
  const { setSelectedRecord, toggleDrawer } = useAppStore();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    recordId: '',
    operator: '',
    startDate: '',
    endDate: '',
    operationType: '',
  });
  const [selectedRecordHistory, setSelectedRecordHistory] = useState<string | null>(null);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const loadHistory = useCallback(async () => {
    await refreshHistory();
  }, [refreshHistory]);

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
    const record = getRecordById(recordId);
    if (record) {
      setSelectedRecord(record);
      toggleDrawer(true);
      setSelectedRecordHistory(recordId);
    }
  };

  const handleJumpToRecord = (recordId: string) => {
    navigate('/');
    setTimeout(() => {
      handleViewRecord(recordId);
    }, 150);
  };

  const filteredHistory = history.filter((item) => {
    if (filters.recordId && !item.recordId?.includes(filters.recordId)) return false;
    if (filters.operator && !item.operator.includes(filters.operator)) return false;
    if (filters.startDate && item.createdAt < filters.startDate) return false;
    if (filters.endDate && item.createdAt > filters.endDate + ' 23:59:59') return false;
    if (filters.operationType && item.operationType !== filters.operationType) return false;
    return true;
  });

  const groupedByDate = filteredHistory.reduce((acc, item) => {
    const date = item.createdAt.split(' ')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, OperationHistory[]>);

  const getRecordLifecycle = (recordId: string) => {
    return history
      .filter((h) => h.recordId === recordId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const StateCompareCard = ({ item }: { item: OperationHistory }) => {
    const beforeParsed = parseStateJson(item.beforeState);
    const afterParsed = parseStateJson(item.afterState);

    const displayNextHandler = afterParsed.nextHandler || beforeParsed.nextHandler;
    const displayReason = afterParsed.reason || beforeParsed.reason;

    return (
      <div className="mt-3 space-y-3">
        {(beforeParsed.status || afterParsed.status) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                前状态 beforeState
              </div>
              {beforeParsed.status ? (
                <StatusBadge status={beforeParsed.status} />
              ) : (
                <span className="text-xs text-gray-400">-</span>
              )}
              {beforeParsed.status && (
                <div className="mt-2 text-xs text-gray-500">
                  {statusLabels[beforeParsed.status] || beforeParsed.status}
                </div>
              )}
            </div>
            <div
              className={cn(
                'p-3 rounded-lg border-2',
                afterParsed.status === 'smooth' && 'bg-green-50 border-green-300',
                afterParsed.status === 'gap' && 'bg-orange-50 border-orange-300',
                afterParsed.status === 'supplement' && 'bg-purple-50 border-purple-300',
                afterParsed.status === 'conflict' && 'bg-red-50 border-red-300',
                afterParsed.status === 'pending' && 'bg-slate-50 border-slate-300',
                (afterParsed.status === 'approved' || afterParsed.status === 'reviewed_normal') && 'bg-green-50 border-green-400',
                (afterParsed.status === 'rejected' || afterParsed.status === 'reviewed_abnormal') && 'bg-red-50 border-red-400',
                !afterParsed.status && 'bg-gray-50 border-gray-200'
              )}
            >
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                后状态 afterState
              </div>
              {afterParsed.status ? (
                <StatusBadge status={afterParsed.status} />
              ) : (
                <span className="text-xs text-gray-400">-</span>
              )}
              {afterParsed.status && (
                <div className="mt-2 text-xs text-gray-600">
                  {statusLabels[afterParsed.status] || afterParsed.status}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center text-gray-300">
          <ArrowRight className="w-4 h-4" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {displayNextHandler && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">
                下一步找谁：{getNextHandlerLabel(displayNextHandler)}
              </span>
            </div>
          )}

          {displayReason && (
            <div className="flex-1 min-w-[200px] p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                处理原因
              </div>
              <p className="text-sm text-amber-800">{displayReason}</p>
            </div>
          )}
        </div>
      </div>
    );
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

      {loading && filteredHistory.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          加载中...
        </div>
      ) : filteredHistory.length === 0 ? (
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
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium',
                                  operationColors[item.operationType]
                                )}>
                                  {operationLabels[item.operationType]}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">
                                  {item.createdAt.split(' ')[1]}
                                </span>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                                  {roleLabels[item.operatorRole] || item.operatorRole}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 font-medium">{item.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {item.operator}
                                  <span className="text-gray-400 ml-1">
                                    ({roleLabels[item.operatorRole] || item.operatorRole})
                                  </span>
                                </span>
                                {item.recordId && (
                                  <span className="font-mono text-gray-400">
                                    ID: {item.recordId}
                                  </span>
                                )}
                              </div>

                              {(item.beforeState || item.afterState) && (
                                <StateCompareCard item={item} />
                              )}
                            </div>
                            {item.recordId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJumpToRecord(item.recordId);
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                title="跳转到记录并打开证据链"
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
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-medium text-gray-700">
                                              {operationLabels[event.operationType]}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-mono">
                                              {event.createdAt.split(' ')[1]}
                                            </span>
                                            {event.operatorRole && (
                                              <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[9px]">
                                                {roleLabels[event.operatorRole] || event.operatorRole}
                                              </span>
                                            )}
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
