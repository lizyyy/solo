import React from 'react';
import type { FilterState, SourceType, ChangeType, RecordStatus } from '../types';
import { SOURCE_LABELS, CHANGE_TYPE_LABELS, STATUS_LABELS } from '../types';
import { useArchiveStore } from '../store/archiveStore';
import { Search, Filter, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface FilterPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function FilterPanel({ isOpen, onToggle }: FilterPanelProps) {
  const { filterState, students, setFilterState, resetFilterState } = useArchiveStore();
  const [localSearch, setLocalSearch] = React.useState(filterState.searchQuery || '');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filterState.searchQuery) {
        setFilterState({ searchQuery: localSearch || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const activeFilterCount = [
    filterState.studentId,
    filterState.dateRange,
    filterState.sourceTypes?.length,
    filterState.changeTypes?.length,
    filterState.statuses?.length,
  ].filter(Boolean).length;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-600" />
          <span className="font-medium text-sm text-neutral-800">筛选条件</span>
          {activeFilterCount > 0 && (
            <span className="badge bg-primary-100 text-primary-700 text-[10px]">
              {activeFilterCount} 项
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetFilterState();
                setLocalSearch('');
              }}
              className="text-xs text-neutral-500 hover:text-danger-500 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-neutral-100 pt-4 animate-fade-in">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              搜索
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="学生姓名、曲目、录入人..."
                className="input-field pl-9 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              学生
            </label>
            <select
              value={filterState.studentId || ''}
              onChange={(e) => setFilterState({ studentId: e.target.value || undefined })}
              className="input-field text-sm"
            >
              <option value="">全部学生</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}（{s.grade}）
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              日期范围
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filterState.dateRange?.[0] || ''}
                onChange={(e) => {
                  const from = e.target.value;
                  const to = filterState.dateRange?.[1] || '';
                  if (from && to) {
                    setFilterState({ dateRange: [from, to] });
                  } else if (from) {
                    setFilterState({ dateRange: [from, ''] });
                  } else {
                    setFilterState({ dateRange: undefined });
                  }
                }}
                className="input-field text-sm flex-1"
              />
              <span className="text-neutral-400 self-center text-xs">至</span>
              <input
                type="date"
                value={filterState.dateRange?.[1] || ''}
                onChange={(e) => {
                  const from = filterState.dateRange?.[0] || '';
                  const to = e.target.value;
                  if (from && to) {
                    setFilterState({ dateRange: [from, to] });
                  } else if (to) {
                    setFilterState({ dateRange: ['', to] });
                  } else {
                    setFilterState({ dateRange: undefined });
                  }
                }}
                className="input-field text-sm flex-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              数据来源
            </label>
            <div className="flex flex-wrap gap-2">
              {(['metronome', 'song_list', 'sheet_music'] as SourceType[]).map(type => (
                <label
                  key={type}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm
                    ${filterState.sourceTypes?.includes(type)
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={filterState.sourceTypes?.includes(type) || false}
                    onChange={(e) => {
                      const current = filterState.sourceTypes || [];
                      const updated = e.target.checked
                        ? [...current, type]
                        : current.filter(t => t !== type);
                      setFilterState({ sourceTypes: updated.length > 0 ? updated : undefined });
                    }}
                    className="sr-only"
                  />
                  {SOURCE_LABELS[type]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              变动类型
            </label>
            <div className="flex gap-2">
              {(['supplement', 'revision'] as ChangeType[]).map(type => (
                <label
                  key={type}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm
                    ${filterState.changeTypes?.includes(type)
                      ? type === 'revision'
                        ? 'bg-danger-50 border-danger-300 text-danger-700'
                        : 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={filterState.changeTypes?.includes(type) || false}
                    onChange={(e) => {
                      const current = filterState.changeTypes || [];
                      const updated = e.target.checked
                        ? [...current, type]
                        : current.filter(t => t !== type);
                      setFilterState({ changeTypes: updated.length > 0 ? updated : undefined });
                    }}
                    className="sr-only"
                  />
                  {CHANGE_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              状态
            </label>
            <div className="flex flex-wrap gap-2">
              {(['normal', 'duplicate', 'transposition_mismatch'] as RecordStatus[]).map(type => (
                <label
                  key={type}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm
                    ${filterState.statuses?.includes(type)
                      ? type === 'duplicate'
                        ? 'bg-warning-50 border-warning-300 text-warning-700'
                        : type === 'transposition_mismatch'
                          ? 'bg-danger-50 border-danger-300 text-danger-700'
                          : 'bg-success-50 border-success-300 text-success-700'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={filterState.statuses?.includes(type) || false}
                    onChange={(e) => {
                      const current = filterState.statuses || [];
                      const updated = e.target.checked
                        ? [...current, type]
                        : current.filter(t => t !== type);
                      setFilterState({ statuses: updated.length > 0 ? updated : undefined });
                    }}
                    className="sr-only"
                  />
                  {STATUS_LABELS[type]}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
