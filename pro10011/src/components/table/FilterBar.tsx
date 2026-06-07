import { Search, Filter, RefreshCw, X } from 'lucide-react';
import { useRecordStore } from '../../store/useRecordStore';
import type { RecordStatus, FilterParams } from '../../types';

const statusOptions: { value: RecordStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'abnormal', label: '异常' },
  { value: 'normal', label: '正常' },
  { value: 'false_positive', label: '误命中' }
];

export const FilterBar = () => {
  const filters = useRecordStore(state => state.filters);
  const setFilters = useRecordStore(state => state.setFilters);
  const resetFilters = useRecordStore(state => state.resetFilters);
  const statistics = useRecordStore(state => state.getStatistics());
  const getFilteredRecords = useRecordStore(state => state.getFilteredRecords);
  
  const filteredCount = getFilteredRecords().length;

  const handleChange = (key: keyof FilterParams, value: any) => {
    setFilters({ [key]: value });
  };

  const hasActiveFilters = filters.status !== 'all' || 
    filters.excludeFalsePositive || 
    filters.keyword ||
    filters.counterparty ||
    filters.productType;

  return (
    <div className="bg-white border border-gray-200 rounded-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">筛选条件</span>
          <span className="text-xs text-gray-500">（共 {filteredCount} 条记录）</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <X size={14} />
            清除筛选
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-5 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">状态</label>
          <select
            value={filters.status || 'all'}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full h-8 px-2 text-sm border border-gray-200 rounded-sm focus:border-blue-400 focus:outline-none bg-white"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">交易对手</label>
          <input
            type="text"
            value={filters.counterparty || ''}
            onChange={(e) => handleChange('counterparty', e.target.value)}
            placeholder="输入交易对手名称"
            className="w-full h-8 px-2 text-sm border border-gray-200 rounded-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">产品类型</label>
          <input
            type="text"
            value={filters.productType || ''}
            onChange={(e) => handleChange('productType', e.target.value)}
            placeholder="输入产品类型"
            className="w-full h-8 px-2 text-sm border border-gray-200 rounded-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">关键词</label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.keyword || ''}
              onChange={(e) => handleChange('keyword', e.target.value)}
              placeholder="搜索交易编号等"
              className="w-full h-8 pl-7 pr-2 text-sm border border-gray-200 rounded-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.excludeFalsePositive || false}
              onChange={(e) => handleChange('excludeFalsePositive', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">排除名单误命中</span>
          </label>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-6">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-500">快速统计：</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            待处理 {statistics.pending}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            异常 {statistics.abnormal}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            正常 {statistics.normal}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            误命中 {statistics.falsePositive}
          </span>
        </div>
      </div>
    </div>
  );
};
