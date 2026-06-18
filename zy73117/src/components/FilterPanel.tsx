import { Search, RotateCcw, Building2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { STATUS_LABELS, type MaterialStatus } from '@/types';
import { detectExceptions } from '@/utils/traceEngine';

const allStatuses: MaterialStatus[] = ['normal', 'withdrawn', 'changed', 'exception'];

export function FilterPanel() {
  const filters = useStore((state) => state.filters);
  const setFilters = useStore((state) => state.setFilters);
  const resetFilters = useStore((state) => state.resetFilters);
  const materials = useStore((state) => state.materials);
  const records = useStore((state) => state.records);
  const showFiltersRestored = useStore((state) => state.showFiltersRestored);
  const setShowFiltersRestored = useStore((state) => state.setShowFiltersRestored);

  const buildingNos = Array.from(new Set(materials.map((m) => m.buildingNo)));

  const toggleStatus = (status: MaterialStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    setFilters({ statuses: newStatuses });
  };

  const hasActiveFilters =
    filters.statuses.length > 0 ||
    filters.keyword ||
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.buildingNo ||
    filters.onlyPending ||
    filters.onlyException;

  const pendingCount = materials.filter((m) => {
    if (m.isPending) return true;
    const { hasException } = detectExceptions(m, records);
    return hasException;
  }).length;

  const exceptionCount = materials.filter((m) => m.status === 'exception').length;

  return (
    <div className="h-full flex flex-col bg-industrial-900 border-r border-industrial-700">
      {showFiltersRestored && (
        <div className="bg-primary-900/50 border-b border-primary-700 px-4 py-2 text-sm text-primary-200 flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            筛选条件已从上次会话恢复
          </span>
          <button
            onClick={() => setShowFiltersRestored(false)}
            className="text-primary-300 hover:text-primary-100 transition-colors"
          >
            知道了
          </button>
        </div>
      )}

      <div className="p-4 border-b border-industrial-700">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-industrial-100">筛选条件</h2>
          {hasActiveFilters && (
            <span className="chip bg-primary-900/50 border-primary-600 text-primary-300">
              已激活
            </span>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-industrial-500" />
          <input
            type="text"
            placeholder="搜索项目、楼号、测绘编号..."
            value={filters.keyword}
            onChange={(e) => setFilters({ keyword: e.target.value })}
            className="input-field pl-10"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="label-field">状态筛选</label>
            <div className="flex flex-wrap gap-2">
              {allStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`chip transition-colors ${
                    filters.statuses.includes(status)
                      ? status === 'normal'
                        ? 'bg-success-900/50 border-success-600 text-success-300'
                        : status === 'withdrawn'
                        ? 'bg-danger-900/50 border-danger-600 text-danger-300'
                        : status === 'changed'
                        ? 'bg-primary-900/50 border-primary-600 text-primary-300'
                        : 'bg-warning-900/50 border-warning-600 text-warning-300'
                      : 'bg-industrial-800 border-industrial-600 text-industrial-400 hover:border-industrial-500'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">
              <Building2 className="w-3.5 h-3.5 inline mr-1" />
              楼号筛选
            </label>
            <select
              value={filters.buildingNo}
              onChange={(e) => setFilters({ buildingNo: e.target.value })}
              className="input-field"
            >
              <option value="">全部楼号</option>
              {buildingNos.map((no) => (
                <option key={no} value={no}>
                  {no}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label-field">开始日期</label>
              <input
                type="date"
                value={filters.dateRange.start || ''}
                onChange={(e) =>
                  setFilters({ dateRange: { ...filters.dateRange, start: e.target.value || null } })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">结束日期</label>
              <input
                type="date"
                value={filters.dateRange.end || ''}
                onChange={(e) =>
                  setFilters({ dateRange: { ...filters.dateRange, end: e.target.value || null } })
                }
                className="input-field"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.onlyPending}
                onChange={(e) => setFilters({ onlyPending: e.target.checked })}
                className="w-4 h-4 rounded border-industrial-600 bg-industrial-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-industrial-900"
              />
              <span className="text-sm text-industrial-300 group-hover:text-industrial-100 transition-colors flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning-400" />
                仅看待处理
                {pendingCount > 0 && (
                  <span className="badge bg-warning-900/50 text-warning-300">{pendingCount}条</span>
                )}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.onlyException}
                onChange={(e) => setFilters({ onlyException: e.target.checked })}
                className="w-4 h-4 rounded border-industrial-600 bg-industrial-800 text-warning-500 focus:ring-warning-500 focus:ring-offset-industrial-900"
              />
              <span className="text-sm text-industrial-300 group-hover:text-industrial-100 transition-colors flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger-400" />
                仅看异常
                {exceptionCount > 0 && (
                  <span className="badge bg-danger-900/50 text-danger-300">{exceptionCount}条</span>
                )}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-industrial-700">
        <button
          onClick={resetFilters}
          disabled={!hasActiveFilters}
          className="w-full btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" />
          重置筛选条件
        </button>
      </div>
    </div>
  );
}
