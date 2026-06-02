import { useState, useMemo } from 'react';
import { Search, Filter, User, Calendar, ChevronLeft, ChevronRight, FileText, Clock } from 'lucide-react';
import { useAppStore } from '@/store';
import { ActionType, actionTypeLabels } from '@/types';
import { formatDateTime } from '@/utils/stringUtils';
import { cn } from '@/utils/cn';

const PAGE_SIZE = 20;

const actionTypeColors: Record<ActionType, { bg: string; text: string; border: string; dot: string }> = {
  import: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  export: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  merge: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  split: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  confirm: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  reject: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  update: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
};

const actionTypes: ActionType[] = ['import', 'merge', 'split', 'confirm', 'reject', 'export', 'update'];

export default function LogsPage() {
  const { logs, points } = useAppStore();

  const [actionTypeFilter, setActionTypeFilter] = useState<ActionType | ''>('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const operators = useMemo(() => {
    const uniqueOperators = [...new Set(logs.map(log => log.operator))];
    return uniqueOperators.sort();
  }, [logs]);

  const getPointName = (pointId: string) => {
    const point = points.find(p => p.id === pointId);
    return point?.canonicalName || '未知点位';
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (actionTypeFilter && log.action !== actionTypeFilter) return false;
      if (operatorFilter && log.operator !== operatorFilter) return false;
      if (dateFrom && new Date(log.timestamp) < new Date(dateFrom)) return false;
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(log.timestamp) > toDate) return false;
      }
      if (searchQuery) {
        const pointName = getPointName(log.pointId).toLowerCase();
        const query = searchQuery.toLowerCase();
        if (!pointName.includes(query)) return false;
      }
      return true;
    });
  }, [logs, actionTypeFilter, operatorFilter, dateFrom, dateTo, searchQuery, points]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Clock size={64} className="mx-auto mb-4 text-neutral-300" />
          <h3 className="text-xl font-serif font-semibold text-neutral-800 mb-2">暂无操作日志</h3>
          <p className="text-neutral-500">系统运行后将自动记录所有操作</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="搜索点位名称..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleFilterChange();
              }}
              className="input pl-9 w-64"
            />
          </div>

          <select
            value={actionTypeFilter}
            onChange={(e) => {
              setActionTypeFilter(e.target.value as ActionType | '');
              handleFilterChange();
            }}
            className="select w-36"
          >
            <option value="">全部操作类型</option>
            {actionTypes.map(type => (
              <option key={type} value={type}>{actionTypeLabels[type]}</option>
            ))}
          </select>

          <select
            value={operatorFilter}
            onChange={(e) => {
              setOperatorFilter(e.target.value);
              handleFilterChange();
            }}
            className="select w-40"
          >
            <option value="">全部操作人</option>
            {operators.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-neutral-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                handleFilterChange();
              }}
              className="input w-36"
              placeholder="开始日期"
            />
            <span className="text-neutral-400">至</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                handleFilterChange();
              }}
              className="input w-36"
              placeholder="结束日期"
            />
          </div>

          <button
            onClick={() => {
              setActionTypeFilter('');
              setOperatorFilter('');
              setDateFrom('');
              setDateTo('');
              setSearchQuery('');
              setCurrentPage(1);
            }}
            className="btn-default text-sm"
          >
            重置筛选
          </button>

          <div className="ml-auto text-sm text-neutral-500">
            共 <span className="font-medium text-primary-600">{filteredLogs.length}</span> 条记录
          </div>
        </div>
      </div>

      <div className="card flex-1 overflow-auto">
        <div className="relative pl-8">
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-neutral-200" />

          {paginatedLogs.map((log, index) => {
            const colors = actionTypeColors[log.action];
            const isLast = index === paginatedLogs.length - 1;
            const pointName = getPointName(log.pointId);

            return (
              <div key={log.id} className="relative mb-6 last:mb-0">
                <div
                  className={cn(
                    'absolute left-[-20px] w-4 h-4 rounded-full border-2 border-white shadow-sm z-10',
                    colors.dot
                  )}
                />

                <div className="bg-white border border-neutral-200 rounded-sm hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-sm border',
                          colors.bg,
                          colors.text,
                          colors.border
                        )}>
                          {actionTypeLabels[log.action]}
                        </span>
                        <h4 className="font-medium text-neutral-800">{pointName}</h4>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-neutral-500">
                        <Clock size={12} />
                        {formatDateTime(log.timestamp)}
                      </div>
                    </div>

                    <div className="text-sm text-neutral-600 mb-2">
                      {log.detail}
                    </div>

                    {log.evidence && (
                      <div className="flex items-start gap-2 text-xs text-neutral-500 bg-neutral-50 p-2 rounded-sm">
                        <FileText size={12} className="mt-0.5 flex-shrink-0" />
                        <span>证据：{log.evidence}</span>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <User size={12} />
                        <span>操作人：{log.operator}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {paginatedLogs.length === 0 && (
          <div className="text-center py-16 text-neutral-500">
            <Filter size={40} className="mx-auto mb-3 text-neutral-300" />
            <p>暂无符合筛选条件的日志</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 border border-neutral-200 rounded-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} className="text-neutral-600" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    'w-8 h-8 text-sm rounded-sm transition-colors',
                    currentPage === pageNum
                      ? 'bg-primary-500 text-white'
                      : 'hover:bg-neutral-100 text-neutral-600'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 border border-neutral-200 rounded-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} className="text-neutral-600" />
          </button>

          <span className="ml-4 text-sm text-neutral-500">
            第 {currentPage} / {totalPages} 页
          </span>
        </div>
      )}
    </div>
  );
}
