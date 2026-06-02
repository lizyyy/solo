import { useState } from 'react';
import { useTrackStore } from '../store/useTrackStore';
import { Search, Calendar, User, Music, FilterX, ChevronDown, ChevronUp } from 'lucide-react';

export default function FilterPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const filters = useTrackStore((state) => state.filters);
  const setFilters = useTrackStore((state) => state.setFilters);
  const resetFilters = useTrackStore((state) => state.resetFilters);
  const records = useTrackStore((state) => state.records);

  const teachers = Array.from(new Set(records.map(r => r.teacherName).filter(Boolean))).sort();
  const tracks = Array.from(new Set(records.map(r => r.trackName).filter(Boolean))).sort();

  const hasActiveFilters = filters.teacherName || filters.trackName || filters.dateFrom || filters.dateTo;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <button
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Search size={18} className="text-slate-600" />
          <span className="font-medium text-slate-800">筛选条件</span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              已筛选
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <User size={14} />
                教师姓名
              </label>
              <input
                type="text"
                value={filters.teacherName}
                onChange={(e) => setFilters({ teacherName: e.target.value })}
                placeholder="输入教师姓名搜索"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                list="teachers-list"
              />
              <datalist id="teachers-list">
                {teachers.map(t => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <Music size={14} />
                曲目名称
              </label>
              <input
                type="text"
                value={filters.trackName}
                onChange={(e) => setFilters({ trackName: e.target.value })}
                placeholder="输入曲目名称搜索"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                list="tracks-list"
              />
              <datalist id="tracks-list">
                {tracks.map(t => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <Calendar size={14} />
                授权开始日期从
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <Calendar size={14} />
                授权结束日期至
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              >
                <FilterX size={14} />
                重置筛选
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
