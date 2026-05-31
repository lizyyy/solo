import { useState } from 'react';
import { X, Search, Calendar } from 'lucide-react';
import { FilterOptions, WarningStatus } from '../../types';

interface WarningFilterProps {
  filters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
  onClose: () => void;
}

export default function WarningFilter({ filters, onApply, onClose }: WarningFilterProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);

  const handleChange = (key: keyof FilterOptions, value: string | undefined) => {
    setLocalFilters(prev => ({ ...prev, [key]: value || undefined }));
  };

  const handleReset = () => {
    setLocalFilters({});
    onApply({});
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  return (
    <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">筛选条件</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">设备名称</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={localFilters.deviceName || ''}
              onChange={e => handleChange('deviceName', e.target.value)}
              placeholder="搜索设备..."
              className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">状态</label>
          <select
            value={localFilters.status || ''}
            onChange={e => handleChange('status', e.target.value as WarningStatus)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">全部状态</option>
            <option value="normal">正常</option>
            <option value="warning">预警</option>
            <option value="fault">故障</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">开始日期</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={localFilters.startDate ? localFilters.startDate.slice(0, 10) : ''}
              onChange={e => handleChange('startDate', e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">结束日期</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={localFilters.endDate ? localFilters.endDate.slice(0, 10) : ''}
              onChange={e => handleChange('endDate', e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors"
        >
          重置
        </button>
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
        >
          应用
        </button>
      </div>
    </div>
  );
}
