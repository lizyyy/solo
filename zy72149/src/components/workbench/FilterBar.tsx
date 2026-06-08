import { Search, Filter, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { EMOTION_TAGS, SOURCE_TYPES, EXCEPTION_TYPES } from '../../types';
import type { MaterialStatus } from '../../types';

const FilterBar = () => {
  const { filter, setFilter, resetFilter, getFilteredMaterials } = useStore();
  const filteredCount = getFilteredMaterials().length;

  const statusOptions: { value: MaterialStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部状态' },
    { value: 'pending', label: '待复核' },
    { value: 'reviewed', label: '已复核' },
    { value: 'exception', label: '有异常' },
    { value: 'resolved', label: '已解决' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">筛选条件</span>
          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
            显示 {filteredCount} 条
          </span>
        </div>
        <button
          onClick={resetFilter}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <X className="w-3 h-3" />
          重置筛选
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="lg:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">搜索</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filter.searchKeyword}
              onChange={(e) => setFilter({ searchKeyword: e.target.value })}
              placeholder="搜索文件名、曲目名、备注..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">情绪标签</label>
          <select
            value={filter.emotionTag}
            onChange={(e) => setFilter({ emotionTag: e.target.value as typeof filter.emotionTag })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="all">全部标签</option>
            {EMOTION_TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag || '未标注'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">状态</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ status: e.target.value as typeof filter.status })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">来源</label>
          <select
            value={filter.source}
            onChange={(e) => setFilter({ source: e.target.value as typeof filter.source })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="all">全部来源</option>
            {SOURCE_TYPES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">异常类型</label>
          <select
            value={filter.exceptionType}
            onChange={(e) => setFilter({ exceptionType: e.target.value as typeof filter.exceptionType })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="all">全部异常</option>
            {EXCEPTION_TYPES.map((exc) => (
              <option key={exc.type} value={exc.type}>
                {exc.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
