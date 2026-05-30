import { Search, Filter, X } from 'lucide-react';
import type { FilterCriteria } from '@shared/types';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filters: FilterCriteria;
  onChange: (filters: FilterCriteria) => void;
  onReset: () => void;
}

const copyrightOptions = [
  { value: 'active', label: '版权有效', color: 'gold' },
  { value: 'pending', label: '待审核', color: 'orange' },
];

export default function FilterPanel({ filters, onChange, onReset }: FilterPanelProps) {
  const handleCopyrightToggle = (status: 'active' | 'pending') => {
    const current = filters.copyrightStatus || [];
    const next = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onChange({ ...filters, copyrightStatus: next.length > 0 ? next : undefined });
  };

  const hasActiveFilters =
    (filters.copyrightStatus && filters.copyrightStatus.length > 0) ||
    filters.minVotes ||
    filters.maxDuration ||
    filters.maxStamina ||
    filters.searchKeyword;

  return (
    <div className="card-stage p-5 space-y-6 sticky top-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gold" />
          <h2 className="font-serif font-semibold text-gold">筛选条件</h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-xs text-neutral-500 hover:text-red transition-colors flex items-center gap-1"
          >
            <X size={14} />
            重置
          </button>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          关键词搜索
        </label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={filters.searchKeyword || ''}
            onChange={(e) => onChange({ ...filters, searchKeyword: e.target.value || undefined })}
            placeholder="搜索曲名、艺术家..."
            className="input-stage pl-10"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          版权状态
        </label>
        <div className="flex flex-wrap gap-2">
          {copyrightOptions.map((option) => {
            const isSelected = filters.copyrightStatus?.includes(option.value as 'active' | 'pending');
            return (
              <button
                key={option.value}
                onClick={() => handleCopyrightToggle(option.value as 'active' | 'pending')}
                className={cn(
                  'px-3 py-1.5 rounded-stage text-xs font-medium transition-all duration-200 border',
                  isSelected
                    ? option.color === 'gold'
                      ? 'bg-gold/20 border-gold/50 text-gold'
                      : 'bg-orange/20 border-orange/50 text-orange'
                    : 'bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:border-neutral-600'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            最小投票数
          </label>
          <span className="font-mono text-xs text-gold">
            {filters.minVotes || 0} 票
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="500"
          step="10"
          value={filters.minVotes || 0}
          onChange={(e) => onChange({ ...filters, minVotes: Number(e.target.value) || undefined })}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-gold"
        />
        <div className="flex justify-between text-xs text-neutral-600">
          <span>0</span>
          <span>500</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            最大时长
          </label>
          <span className="font-mono text-xs text-gold">
            {filters.maxDuration || 600} 秒 ({Math.floor((filters.maxDuration || 600) / 60)}分钟)
          </span>
        </div>
        <input
          type="range"
          min="120"
          max="600"
          step="30"
          value={filters.maxDuration || 600}
          onChange={(e) => onChange({ ...filters, maxDuration: Number(e.target.value) || undefined })}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-gold"
        />
        <div className="flex justify-between text-xs text-neutral-600">
          <span>2分钟</span>
          <span>10分钟</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            最大体力消耗
          </label>
          <span className="font-mono text-xs text-orange">
            {'★'.repeat(filters.maxStamina || 5)}{'☆'.repeat(5 - (filters.maxStamina || 5))}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={filters.maxStamina || 5}
          onChange={(e) => onChange({ ...filters, maxStamina: Number(e.target.value) || undefined })}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange"
        />
        <div className="flex justify-between text-xs text-neutral-600">
          <span>轻松</span>
          <span>高难度</span>
        </div>
      </div>
    </div>
  );
}
