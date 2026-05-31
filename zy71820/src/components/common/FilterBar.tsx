import React from 'react';
import { Search, Calendar, Filter, RotateCcw, RefreshCw } from 'lucide-react';
import { debouncedSaveViewState } from '@/utils/viewSync';
import type { ViewState, LevelConfig } from '@/types/data';

interface FilterBarProps {
  page?: string;
  filters?: ViewState['filters'];
  levels?: LevelConfig[];
  onFilterChange?: (filters: ViewState['filters']) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  showStatusFilter?: boolean;
}

export function FilterBar({
  page,
  filters: externalFilters,
  levels: externalLevels,
  onFilterChange,
  onRefresh,
  isLoading,
  showStatusFilter = true,
}: FilterBarProps) {
  const [internalFilters, setInternalFilters] = React.useState<ViewState['filters']>(
    externalFilters || { status: ['normal', 'pending', 'corrected', 'rejected'] }
  );
  const filters = externalFilters || internalFilters;
  const levels = externalLevels || [];

  React.useEffect(() => {
    if (externalFilters) {
      setInternalFilters(externalFilters);
    }
  }, [externalFilters]);

  const handleFilterChange = (key: string, value: unknown) => {
    const newFilters = { ...filters, [key]: value };
    
    if (onFilterChange) {
      onFilterChange(newFilters);
    } else {
      setInternalFilters(newFilters);
    }
    
    if (page) {
      debouncedSaveViewState(page, { filters: newFilters });
    }
  };

  const handleReset = () => {
    const defaultFilters: ViewState['filters'] = {
      status: ['normal', 'pending', 'corrected', 'rejected'],
    };
    
    if (onFilterChange) {
      onFilterChange(defaultFilters);
    } else {
      setInternalFilters(defaultFilters);
    }
    
    if (page) {
      debouncedSaveViewState(page, { filters: undefined });
    }
  };

  return (
    <div className="bg-night-surface/80 backdrop-blur-md rounded-2xl p-4 border border-night-card">
      <div className="flex items-center gap-2 mb-4">
        <Filter size={18} className="text-neon-orange" />
        <span className="font-title text-lg text-white">筛选条件</span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="ml-auto flex items-center gap-1 text-sm text-gray-400 hover:text-neon-orange transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            刷新
          </button>
        )}
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-neon-orange transition-colors"
        >
          <RotateCcw size={14} />
          重置
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索玩家名称..."
            value={filters.playerName || ''}
            onChange={(e) => handleFilterChange('playerName', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-night-card border border-night-card rounded-xl text-white placeholder-gray-500 focus:border-neon-orange/50 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <select
            value={filters.levelId || ''}
            onChange={(e) => handleFilterChange('levelId', e.target.value || undefined)}
            className="w-full px-4 py-2.5 bg-night-card border border-night-card rounded-xl text-white focus:border-neon-orange/50 focus:outline-none transition-colors appearance-none cursor-pointer"
          >
            <option value="">全部关卡</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <select
            value={filters.timeRange ? 'custom' : 'all'}
            onChange={(e) => {
              if (e.target.value === 'all') {
                handleFilterChange('timeRange', undefined);
              } else if (e.target.value === 'today') {
                const now = Date.now();
                const today = new Date().setHours(0, 0, 0, 0);
                handleFilterChange('timeRange', [today, now]);
              } else if (e.target.value === 'week') {
                const now = Date.now();
                const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
                handleFilterChange('timeRange', [weekAgo, now]);
              }
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-night-card border border-night-card rounded-xl text-white focus:border-neon-orange/50 focus:outline-none transition-colors appearance-none cursor-pointer"
          >
            <option value="all">全部时间</option>
            <option value="today">今天</option>
            <option value="week">最近7天</option>
          </select>
        </div>

        {showStatusFilter && (
          <div className="flex flex-wrap gap-2">
            {['normal', 'pending', 'corrected', 'rejected'].map((status) => {
              const isSelected = filters.status?.includes(status);
              const labels: Record<string, string> = {
                normal: '正常',
                pending: '待复核',
                corrected: '已修正',
                rejected: '已驳回',
              };
              return (
                <button
                  key={status}
                  onClick={() => {
                    const current = filters.status || [];
                    const next = isSelected
                      ? current.filter((s) => s !== status)
                      : [...current, status];
                    handleFilterChange('status', next);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-body transition-all ${
                    isSelected
                      ? 'bg-neon-orange text-white shadow-neon-orange'
                      : 'bg-night-card text-gray-400 hover:text-white'
                  }`}
                >
                  {labels[status]}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
