import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { FilterConditions, CableStatus, SourceType, ROOMS, CABINETS, CABLE_TYPES, STATUS_LABELS, SOURCE_TYPE_LABELS } from '@/types';

interface FilterPanelProps {
  filters: FilterConditions;
  onChange: (filters: Partial<FilterConditions>) => void;
  onReset: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onChange, onReset }) => {
  const toggleArrayValue = <T extends string>(key: keyof FilterConditions, value: T) => {
    const current = filters[key] as T[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onChange({ [key]: updated });
  };

  const hasActiveFilters = 
    filters.rooms.length > 0 ||
    filters.cabinets.length > 0 ||
    filters.statuses.length > 0 ||
    filters.sourceTypes.length > 0 ||
    filters.cableTypes.length > 0 ||
    filters.searchText;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-800">筛选条件</h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            重置
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索编号、机房、机柜、备注..."
            value={filters.searchText}
            onChange={(e) => onChange({ searchText: e.target.value })}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">状态</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_LABELS) as CableStatus[]).map(status => (
              <button
                key={status}
                onClick={() => toggleArrayValue('statuses', status)}
                className={`px-2.5 py-1 text-xs rounded border transition-all ${
                  filters.statuses.includes(status)
                    ? 'bg-signal-blue text-white border-signal-blue'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">机房</label>
          <div className="flex flex-wrap gap-1.5">
            {ROOMS.map(room => (
              <button
                key={room}
                onClick={() => toggleArrayValue('rooms', room)}
                className={`px-2.5 py-1 text-xs rounded border transition-all ${
                  filters.rooms.includes(room)
                    ? 'bg-industrial-800 text-white border-industrial-800'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {room}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">机柜</label>
          <div className="flex flex-wrap gap-1.5">
            {CABINETS.map(cabinet => (
              <button
                key={cabinet}
                onClick={() => toggleArrayValue('cabinets', cabinet)}
                className={`px-2 py-1 text-xs rounded border transition-all font-mono ${
                  filters.cabinets.includes(cabinet)
                    ? 'bg-industrial-800 text-white border-industrial-800'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {cabinet}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">数据来源</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map(type => (
              <button
                key={type}
                onClick={() => toggleArrayValue('sourceTypes', type)}
                className={`px-2.5 py-1 text-xs rounded border transition-all ${
                  filters.sourceTypes.includes(type)
                    ? 'bg-industrial-700 text-white border-industrial-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {SOURCE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">线缆类型</label>
          <div className="flex flex-wrap gap-1.5">
            {CABLE_TYPES.map(type => (
              <button
                key={type}
                onClick={() => toggleArrayValue('cableTypes', type)}
                className={`px-2.5 py-1 text-xs rounded border transition-all ${
                  filters.cableTypes.includes(type)
                    ? 'bg-industrial-600 text-white border-industrial-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
