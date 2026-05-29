import { useState } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { STATUS_LABELS, CONFLICT_DETAILS, type ApplicationStatus, type ConflictType } from '@/types';
import { cn } from '@/lib/utils';

export default function FilterPanel() {
  const { filterConditions, setFilterConditions, clearFilterConditions } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = Object.keys(filterConditions).some(
    (key) =>
      filterConditions[key as keyof typeof filterConditions] !== undefined &&
      filterConditions[key as keyof typeof filterConditions] !== null &&
      filterConditions[key as keyof typeof filterConditions] !== '' &&
      (Array.isArray(filterConditions[key as keyof typeof filterConditions])
        ? (filterConditions[key as keyof typeof filterConditions] as unknown[]).length > 0
        : true)
  );

  const handleStatusChange = (status: ApplicationStatus) => {
    const current = filterConditions.applicationStatus || [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setFilterConditions({ applicationStatus: next.length > 0 ? next : undefined });
  };

  const handleConflictChange = (type: ConflictType) => {
    const current = filterConditions.conflictTypes || [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setFilterConditions({ conflictTypes: next.length > 0 ? next : undefined });
  };

  return (
    <div className="card mb-6 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 bg-neutral-50 border-b border-neutral-200 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-600" />
          <span className="font-medium text-neutral-800">筛选条件</span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent-100 text-accent-700">
              已筛选
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFilterConditions();
              }}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <X className="w-3 h-3" />
              清除全部
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          )}
        </div>
      </div>

      <div className={cn('px-5 py-4 space-y-4', !isExpanded && 'hidden')}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              债券代码
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={filterConditions.bondCode || ''}
                onChange={(e) =>
                  setFilterConditions({ bondCode: e.target.value || undefined })
                }
                placeholder="输入债券代码..."
                className="input-field pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              客户名称
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={filterConditions.customerName || ''}
                onChange={(e) =>
                  setFilterConditions({ customerName: e.target.value || undefined })
                }
                placeholder="输入客户名称..."
                className="input-field pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              行权日开始
            </label>
            <input
              type="date"
              value={filterConditions.exerciseDateStart || ''}
              onChange={(e) =>
                setFilterConditions({ exerciseDateStart: e.target.value || undefined })
              }
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              行权日结束
            </label>
            <input
              type="date"
              value={filterConditions.exerciseDateEnd || ''}
              onChange={(e) =>
                setFilterConditions({ exerciseDateEnd: e.target.value || undefined })
              }
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            申请状态
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <button
                key={value}
                onClick={() => handleStatusChange(value as ApplicationStatus)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded border-2 transition-all',
                  filterConditions.applicationStatus?.includes(value as ApplicationStatus)
                    ? 'bg-accent-500 text-white border-accent-500'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:border-accent-400'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            异常类型
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CONFLICT_DETAILS).map(([value, detail]) => (
              <button
                key={value}
                onClick={() => handleConflictChange(value as ConflictType)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded border-2 transition-all',
                  filterConditions.conflictTypes?.includes(value as ConflictType)
                    ? 'bg-conflict-withdrawn text-white border-conflict-withdrawn'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:border-conflict-date'
                )}
              >
                {detail.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              最低持仓数量
            </label>
            <input
              type="number"
              value={filterConditions.positionQuantityMin ?? ''}
              onChange={(e) =>
                setFilterConditions({
                  positionQuantityMin: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="输入最低持仓数量..."
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              最低申请数量
            </label>
            <input
              type="number"
              value={filterConditions.applyQuantityMin ?? ''}
              onChange={(e) =>
                setFilterConditions({
                  applyQuantityMin: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="输入最低申请数量..."
              className="input-field"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
