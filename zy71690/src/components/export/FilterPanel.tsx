import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ErrorType } from '@/types';
import { ERROR_TYPE_LABELS } from '@/types';

interface FilterPanelProps {
  resultTypes: string[];
  errorTypes: string[];
  search: string;
  onResultTypeChange: (types: string[]) => void;
  onErrorTypeChange: (types: string[]) => void;
  onSearchChange: (search: string) => void;
  onClearFilters: () => void;
}

const RESULT_OPTIONS = [
  { value: 'escape', label: '逃逸成功', color: 'text-green-400' },
  { value: 'collide', label: '碰撞失败', color: 'text-red-400' },
  { value: 'orbit', label: '稳定环绕', color: 'text-blue-400' },
  { value: 'chaos', label: '混沌轨道', color: 'text-purple-400' },
  { value: 'timeout', label: '超时未决', color: 'text-yellow-400' },
];

const ERROR_OPTIONS: { value: ErrorType; label: string }[] = [
  { value: 'gravity_direction', label: ERROR_TYPE_LABELS.gravity_direction },
  { value: 'velocity_overflow', label: ERROR_TYPE_LABELS.velocity_overflow },
  { value: 'collision_miss', label: ERROR_TYPE_LABELS.collision_miss },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  resultTypes,
  errorTypes,
  search,
  onResultTypeChange,
  onErrorTypeChange,
  onSearchChange,
  onClearFilters,
}) => {
  const hasActiveFilters =
    resultTypes.length > 0 || errorTypes.length > 0 || search.length > 0;

  const toggleResultType = (value: string) => {
    if (resultTypes.includes(value)) {
      onResultTypeChange(resultTypes.filter((t) => t !== value));
    } else {
      onResultTypeChange([...resultTypes, value]);
    }
  };

  const toggleErrorType = (value: ErrorType) => {
    if (errorTypes.includes(value)) {
      onErrorTypeChange(errorTypes.filter((t) => t !== value));
    } else {
      onErrorTypeChange([...errorTypes, value]);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-300 font-mono">筛选条件</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 font-mono transition-colors"
          >
            <X size={12} />
            清除筛选
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索备注、结论..."
          className={cn(
            'w-full pl-9 pr-3 py-2 text-sm font-mono bg-gray-800 border border-gray-700 rounded-lg',
            'focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500',
            'text-gray-300 placeholder-gray-600'
          )}
        />
      </div>

      <div>
        <div className="text-[10px] text-gray-500 font-mono mb-2">按结果筛选</div>
        <div className="flex flex-wrap gap-2">
          {RESULT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleResultType(option.value)}
              className={cn(
                'px-2 py-1 text-[10px] font-mono rounded border transition-all',
                resultTypes.includes(option.value)
                  ? 'bg-gray-700 border-gray-600'
                  : 'bg-gray-900 border-gray-800 hover:border-gray-700'
              )}
            >
              <span className={option.color}>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 font-mono mb-2">按异常类型筛选</div>
        <div className="flex flex-wrap gap-2">
          {ERROR_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleErrorType(option.value)}
              className={cn(
                'px-2 py-1 text-[10px] font-mono rounded border transition-all',
                errorTypes.includes(option.value)
                  ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
