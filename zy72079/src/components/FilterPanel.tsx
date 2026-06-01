import { useStore } from '../store/useStore';
import type { RecordStatus, AreaType, DataSource } from '../types';
import { X, Filter } from 'lucide-react';

const statusOptions: { value: RecordStatus; label: string }[] = [
  { value: 'success', label: '顺利完成' },
  { value: 'pending', label: '待确认' },
  { value: 'legacy', label: '旧口径' },
  { value: 'error', label: '计算失败' },
];

const areaOptions: { value: AreaType; label: string }[] = [
  { value: '东城区', label: '东城区' },
  { value: '西城区', label: '西城区' },
  { value: '朝阳区', label: '朝阳区' },
  { value: '海淀区', label: '海淀区' },
  { value: '丰台区', label: '丰台区' },
  { value: '石景山区', label: '石景山区' },
];

const sourceOptions: { value: DataSource; label: string }[] = [
  { value: 'system', label: '系统生成' },
  { value: 'manual', label: '人工录入' },
  { value: 'legacy', label: '历史数据' },
];

export function FilterPanel() {
  const { filters, setFilters } = useStore();

  const handleStatusChange = (status: RecordStatus) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    setFilters({ status: newStatus });
  };

  const handleAreaChange = (area: AreaType) => {
    const newArea = filters.area.includes(area)
      ? filters.area.filter(a => a !== area)
      : [...filters.area, area];
    setFilters({ area: newArea });
  };

  const handleSourceChange = (source: DataSource) => {
    const newSource = filters.source.includes(source)
      ? filters.source.filter(s => s !== source)
      : [...filters.source, source];
    setFilters({ source: newSource });
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setFilters({
      dateRange: { ...filters.dateRange, [field]: value },
    });
  };

  const handleReset = () => {
    setFilters({
      status: [],
      area: [],
      source: [],
      dateRange: { start: '', end: '' },
    });
  };

  const hasActiveFilters = filters.status.length > 0 ||
    filters.area.length > 0 ||
    filters.source.length > 0 ||
    filters.dateRange.start ||
    filters.dateRange.end;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-slate-800 font-display">筛选条件</h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
          >
            <X className="w-4 h-4 mr-1" />
            重置
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">状态</label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map(option => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors duration-200 ${
                  filters.status.includes(option.value)
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">区域</label>
          <div className="flex flex-wrap gap-2">
            {areaOptions.map(option => (
              <button
                key={option.value}
                onClick={() => handleAreaChange(option.value)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors duration-200 ${
                  filters.area.includes(option.value)
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">数据来源</label>
          <div className="flex flex-wrap gap-2">
            {sourceOptions.map(option => (
              <button
                key={option.value}
                onClick={() => handleSourceChange(option.value)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors duration-200 ${
                  filters.source.includes(option.value)
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">开始日期</label>
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={e => handleDateChange('start', e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">结束日期</label>
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={e => handleDateChange('end', e.target.value)}
              className="input-field text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
