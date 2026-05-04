import { format } from 'date-fns';
import { cn } from '../utils/cn';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export const DatePicker = ({
  value,
  onChange,
  placeholder = '选择日期',
  className,
  min,
  max,
}) => (
  <div className={cn('relative', className)}>
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <Calendar className="w-4 h-4 text-gray-400" />
    </div>
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      max={max}
      className={cn(
        'w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg',
        'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
        'text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
        'placeholder-gray-400'
      )}
    />
  </div>
);

export const DateRangePicker = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  className,
  quickRanges = true,
}) => {
  const quickPresets = [
    { label: '最近7天', getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
    }},
    { label: '最近30天', getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
    }},
    { label: '最近90天', getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
    }},
    { label: '本月', getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
    }},
  ];
  
  const applyPreset = (preset) => {
    const { start, end } = preset.getDates();
    onStartChange(start);
    onEndChange(end);
  };
  
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">开始:</span>
          <DatePicker value={startDate} onChange={onStartChange} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">结束:</span>
          <DatePicker value={endDate} onChange={onEndChange} className="w-40" min={startDate} />
        </div>
      </div>
      {quickRanges && (
        <div className="flex flex-wrap gap-2">
          {quickPresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
