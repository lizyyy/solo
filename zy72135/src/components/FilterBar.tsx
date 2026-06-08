import { Search, Filter, X } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { statusLabels, sourceLabels, type RecordStatus, type RecordSource } from '../../shared/types';
import { useEffect, useState } from 'react';

export function FilterBar() {
  const { filters, setFilters } = useRecordStore();
  const [searchInput, setSearchInput] = useState(filters.searchKeyword || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ searchKeyword: searchInput || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  const handleStatusChange = (status: RecordStatus | undefined) => {
    setFilters({ status });
  };

  const handleSourceChange = (source: RecordSource | undefined) => {
    setFilters({ source });
  };

  const clearFilters = () => {
    setFilters({ status: undefined, source: undefined, searchKeyword: undefined });
    setSearchInput('');
  };

  const hasActiveFilters = filters.status || filters.source || filters.searchKeyword;

  return (
    <div className="card mb-6 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <Filter size={18} className="text-slate-600" />
        <h3 className="font-display text-lg font-semibold text-slate-800">筛选条件</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X size={14} />
            清除筛选
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索曲目名称、艺人、备注..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">状态</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStatusChange(undefined)}
                className={`px-3 py-1.5 rounded text-sm transition-all ${
                  !filters.status
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-warm-50 text-slate-600 hover:bg-warm-100'
                }`}
              >
                全部
              </button>
              {Object.entries(statusLabels).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => handleStatusChange(value as RecordStatus)}
                  className={`px-3 py-1.5 rounded text-sm transition-all ${
                    filters.status === value
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-warm-50 text-slate-600 hover:bg-warm-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">来源</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleSourceChange(undefined)}
                className={`px-3 py-1.5 rounded text-sm transition-all ${
                  !filters.source
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-warm-50 text-slate-600 hover:bg-warm-100'
                }`}
              >
                全部
              </button>
              {Object.entries(sourceLabels).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => handleSourceChange(value as RecordSource)}
                  className={`px-3 py-1.5 rounded text-sm transition-all ${
                    filters.source === value
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-warm-50 text-slate-600 hover:bg-warm-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
