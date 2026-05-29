import { usePortfolioStore } from '../../store/usePortfolioStore';
import { allTags, allMediums, allDirections } from '../../data/mockWorks';
import { Filter, Star, X, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function FilterPanel() {
  const criteria = usePortfolioStore(s => s.filterCriteria);
  const setFilterCriteria = usePortfolioStore(s => s.setFilterCriteria);
  const selectAllFiltered = usePortfolioStore(s => s.selectAllFiltered);
  const clearSelection = usePortfolioStore(s => s.clearSelection);

  const toggleTag = (tag: string) => {
    const newTags = criteria.tags.includes(tag)
      ? criteria.tags.filter(t => t !== tag)
      : [...criteria.tags, tag];
    setFilterCriteria({ tags: newTags });
  };

  const toggleMedium = (medium: string) => {
    const newMediums = criteria.mediums.includes(medium)
      ? criteria.mediums.filter(m => m !== medium)
      : [...criteria.mediums, medium];
    setFilterCriteria({ mediums: newMediums });
  };

  const setDirection = (direction: typeof allDirections[number] | null) => {
    setFilterCriteria({ applicationDirection: direction });
  };

  const setMinCompletion = (level: number) => {
    setFilterCriteria({ minCompletion: level });
  };

  const resetFilters = () => {
    setFilterCriteria({
      tags: [],
      mediums: [],
      minCompletion: 1,
      applicationDirection: null
    });
  };

  const hasActiveFilters = criteria.tags.length > 0 ||
    criteria.mediums.length > 0 ||
    criteria.minCompletion > 1 ||
    criteria.applicationDirection !== null;

  return (
    <div className="glass-card rounded-xl p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-ochre-400" />
          <h3 className="font-display text-lg font-semibold text-cream-200">筛选条件</h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-cream-400/70 hover:text-ochre-400 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            重置
          </button>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-cream-400/80 uppercase tracking-wider mb-2 block">
          主题标签
        </label>
        <div className="flex flex-wrap gap-2">
          {allTags.slice(0, 12).map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                'tag',
                criteria.tags.includes(tag) && 'tag-active'
              )}
            >
              {tag}
              {criteria.tags.includes(tag) && (
                <X className="w-3 h-3 ml-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-cream-400/80 uppercase tracking-wider mb-2 block">
          创作媒介
        </label>
        <div className="flex flex-wrap gap-2">
          {allMediums.slice(0, 10).map(medium => (
            <button
              key={medium}
              onClick={() => toggleMedium(medium)}
              className={cn(
                'tag',
                criteria.mediums.includes(medium) && 'tag-active'
              )}
            >
              {medium}
              {criteria.mediums.includes(medium) && (
                <X className="w-3 h-3 ml-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-cream-400/80 uppercase tracking-wider mb-2 block">
          最低完成度
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(level => (
            <button
              key={level}
              onClick={() => setMinCompletion(level)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                criteria.minCompletion === level
                  ? 'bg-ochre-500/20 text-ochre-400 border border-ochre-500/30'
                  : 'bg-charcoal-700/50 text-cream-400/70 border border-transparent hover:bg-charcoal-600/50'
              )}
            >
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: level }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current" />
                ))}
              </div>
              <div className="text-xs mt-1">{level}星</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-cream-400/80 uppercase tracking-wider mb-2 block">
          申请方向
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDirection(null)}
            className={cn(
              'py-2 px-3 rounded-lg text-sm font-medium transition-all text-left',
              criteria.applicationDirection === null
                ? 'bg-ochre-500/20 text-ochre-400 border border-ochre-500/30'
                : 'bg-charcoal-700/50 text-cream-400/70 border border-transparent hover:bg-charcoal-600/50'
            )}
          >
            全部方向
          </button>
          {allDirections.map(dir => (
            <button
              key={dir}
              onClick={() => setDirection(dir)}
              className={cn(
                'py-2 px-3 rounded-lg text-sm font-medium transition-all text-left',
                criteria.applicationDirection === dir
                  ? 'bg-ochre-500/20 text-ochre-400 border border-ochre-500/30'
                  : 'bg-charcoal-700/50 text-cream-400/70 border border-transparent hover:bg-charcoal-600/50'
              )}
            >
              {dir}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 flex gap-2">
        <button
          onClick={selectAllFiltered}
          className="btn-primary flex-1 text-sm py-2"
        >
          全选筛选结果
        </button>
        <button
          onClick={clearSelection}
          className="btn-secondary text-sm py-2"
        >
          清空选择
        </button>
      </div>
    </div>
  );
}
