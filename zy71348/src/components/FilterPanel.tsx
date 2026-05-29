import { useState } from 'react';
import { useRecordStore } from '@/store/useRecordStore';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  STATUS_LABELS,
  CONDITION_GRADES,
  type RecordStatus,
  type ConditionGrade,
} from '@/types';

export function FilterPanel() {
  const [expanded, setExpanded] = useState(false);
  const filters = useRecordStore((s) => s.filters);
  const setFilters = useRecordStore((s) => s.setFilters);
  const resetFilters = useRecordStore((s) => s.resetFilters);
  const records = useRecordStore((s) => s.records);

  const consignors = [...new Set(records.map((r) => r.consignor).filter(Boolean))];

  const toggleStatus = (status: RecordStatus) => {
    const current = filters.status;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setFilters({ status: next });
  };

  const toggleCondition = (condition: ConditionGrade) => {
    const current = filters.condition;
    const next = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    setFilters({ condition: next });
  };

  const hasActiveFilters =
    filters.searchText ||
    filters.status.length > 0 ||
    filters.condition.length > 0 ||
    filters.consignor ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.hasExceptions !== null;

  return (
    <div className="card mb-6">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-vinyl-700" />
          <h3 className="font-semibold font-display text-lg">筛选条件</h3>
          {hasActiveFilters && (
            <span className="bg-caramel-400 text-vinyl-900 text-xs px-2 py-0.5 rounded-sm">
              已启用
            </span>
          )}
        </div>
        <button className="btn-ghost p-1">
          {expanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label-field">关键词搜索</label>
              <input
                type="text"
                className="input-field"
                placeholder="版号、专辑、艺人、寄售人、位置"
                value={filters.searchText}
                onChange={(e) => setFilters({ searchText: e.target.value })}
              />
            </div>

            <div>
              <label className="label-field">寄售人</label>
              <select
                className="input-field"
                value={filters.consignor}
                onChange={(e) => setFilters({ consignor: e.target.value })}
              >
                <option value="">全部</option>
                {consignors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-field">价格区间 (元)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input-field"
                  placeholder="最低"
                  value={filters.minPrice ?? ''}
                  onChange={(e) =>
                    setFilters({
                      minPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
                <span className="self-center text-vinyl-500">-</span>
                <input
                  type="number"
                  className="input-field"
                  placeholder="最高"
                  value={filters.maxPrice ?? ''}
                  onChange={(e) =>
                    setFilters({
                      maxPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label className="label-field">异常状态</label>
              <select
                className="input-field"
                value={filters.hasExceptions === null ? '' : String(filters.hasExceptions)}
                onChange={(e) =>
                  setFilters({
                    hasExceptions: e.target.value === '' ? null : e.target.value === 'true',
                  })
                }
              >
                <option value="">全部</option>
                <option value="true">有异常</option>
                <option value="false">无异常</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label-field">状态</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as RecordStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`px-3 py-1 rounded-sm text-sm transition-colors ${
                    filters.status.includes(status)
                      ? 'bg-vinyl-700 text-white'
                      : 'bg-cream-100 text-vinyl-700 hover:bg-cream-200'
                  }`}
                  onClick={() => toggleStatus(status)}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">品相</label>
            <div className="flex flex-wrap gap-2">
              {CONDITION_GRADES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`px-3 py-1 rounded-sm text-sm transition-colors ${
                    filters.condition.includes(value)
                      ? 'bg-vinyl-700 text-white'
                      : 'bg-cream-100 text-vinyl-700 hover:bg-cream-200'
                  }`}
                  onClick={() => toggleCondition(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={resetFilters}>
              <X className="w-4 h-4 inline mr-1" />
              重置
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
