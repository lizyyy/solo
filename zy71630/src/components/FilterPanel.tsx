import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getGuaranteeTypeLabel } from '@/utils/anomalyDetector';
import { cn } from '@/lib/utils';

export function FilterPanel() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    industries: true,
    maturity: true,
    risk: true,
    guarantee: false,
    other: false,
  });

  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const resetFilters = useAppStore((state) => state.resetFilters);
  const industryTags = useAppStore((state) => state.industryTags);
  const maturityBuckets = useAppStore((state) => state.maturityBuckets);
  const riskRatings = useAppStore((state) => state.riskRatings);
  const loans = useAppStore((state) => state.loans);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleIndustryToggle = (code: string) => {
    const current = filters.industries;
    const updated = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setFilters({ industries: updated });
  };

  const handleMaturityToggle = (code: string) => {
    const current = filters.maturityBuckets;
    const updated = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setFilters({ maturityBuckets: updated });
  };

  const handleRiskToggle = (code: string) => {
    const current = filters.riskRatings;
    const updated = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setFilters({ riskRatings: updated });
  };

  const handleGuaranteeToggle = (type: string) => {
    const current = filters.guaranteeTypes;
    const updated = current.includes(type as any)
      ? current.filter((t) => t !== type)
      : [...current, type as any];
    setFilters({ guaranteeTypes: updated });
  };

  const activeFilterCount =
    filters.industries.length +
    filters.maturityBuckets.length +
    filters.riskRatings.length +
    filters.guaranteeTypes.length +
    (filters.hasAnomaly !== null ? 1 : 0);

  const maxPrincipal = Math.max(...loans.map((l) => l.principal), 1);

  const SectionHeader = ({
    title,
    section,
    count,
  }: {
    title: string;
    section: string;
    count?: number;
  }) => (
    <button
      className="w-full flex items-center justify-between py-3 text-left hover:text-cyan-400 transition-colors"
      onClick={() => toggleSection(section)}
    >
      <span className="flex items-center gap-2">
        <span className="font-medium text-slate-200">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </span>
      {expandedSections[section] ? (
        <ChevronUp className="w-4 h-4 text-slate-400" />
      ) : (
        <ChevronDown className="w-4 h-4 text-slate-400" />
      )}
    </button>
  );

  return (
    <div className="w-72 bg-slate-800/90 backdrop-blur-xl border-r border-slate-700/50 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">筛选条件</h2>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              清除
            </button>
          )}
        </div>
        {activeFilterCount > 0 && (
          <div className="text-xs text-cyan-400">
            已启用 {activeFilterCount} 个筛选条件
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        <div>
          <SectionHeader
            title="行业类型"
            section="industries"
            count={filters.industries.length}
          />
          {expandedSections.industries && (
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {industryTags.map((tag) => (
                <button
                  key={tag.code}
                  onClick={() => handleIndustryToggle(tag.code)}
                  className={cn(
                    'text-xs px-2 py-1.5 rounded border transition-all text-left truncate',
                    filters.industries.includes(tag.code)
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-700/30 border-slate-600/50 text-slate-300 hover:border-slate-500'
                  )}
                  title={tag.name}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader
            title="到期期限"
            section="maturity"
            count={filters.maturityBuckets.length}
          />
          {expandedSections.maturity && (
            <div className="space-y-1.5 mb-3">
              {maturityBuckets.map((bucket) => (
                <button
                  key={bucket.code}
                  onClick={() => handleMaturityToggle(bucket.code)}
                  className={cn(
                    'w-full text-xs px-3 py-2 rounded border transition-all flex items-center justify-between',
                    filters.maturityBuckets.includes(bucket.code)
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-700/30 border-slate-600/50 text-slate-300 hover:border-slate-500'
                  )}
                >
                  <span>{bucket.name}</span>
                  <span className="text-slate-500">
                    {bucket.monthFrom}-{bucket.monthTo}M
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader
            title="风险等级"
            section="risk"
            count={filters.riskRatings.length}
          />
          {expandedSections.risk && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {riskRatings.map((rating) => (
                <button
                  key={rating.code}
                  onClick={() => handleRiskToggle(rating.code)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded border transition-all font-mono',
                    filters.riskRatings.includes(rating.code)
                      ? 'border-cyan-500/50 text-white'
                      : 'border-slate-600/50 text-slate-300 hover:border-slate-500'
                  )}
                  style={{
                    backgroundColor: filters.riskRatings.includes(rating.code)
                      ? rating.color + '40'
                      : 'rgba(51, 65, 85, 0.3)',
                    borderColor: filters.riskRatings.includes(rating.code)
                      ? rating.color
                      : undefined,
                  }}
                >
                  {rating.code}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader
            title="担保方式"
            section="guarantee"
            count={filters.guaranteeTypes.length}
          />
          {expandedSections.guarantee && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['mortgage', 'pledge', 'guarantee', 'credit'].map((type) => (
                <button
                  key={type}
                  onClick={() => handleGuaranteeToggle(type)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded border transition-all',
                    filters.guaranteeTypes.includes(type as any)
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-700/30 border-slate-600/50 text-slate-300 hover:border-slate-500'
                  )}
                >
                  {getGuaranteeTypeLabel(type)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader title="其他条件" section="other" />
          {expandedSections.other && (
            <div className="space-y-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-slate-300">异常标记</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ hasAnomaly: null })}
                    className={cn(
                      'flex-1 text-xs px-3 py-2 rounded border transition-all',
                      filters.hasAnomaly === null
                        ? 'bg-slate-600/50 border-slate-500 text-white'
                        : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500'
                    )}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setFilters({ hasAnomaly: true })}
                    className={cn(
                      'flex-1 text-xs px-3 py-2 rounded border transition-all',
                      filters.hasAnomaly === true
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500'
                    )}
                  >
                    有异常
                  </button>
                  <button
                    onClick={() => setFilters({ hasAnomaly: false })}
                    className={cn(
                      'flex-1 text-xs px-3 py-2 rounded border transition-all',
                      filters.hasAnomaly === false
                        ? 'bg-green-500/20 border-green-500/50 text-green-300'
                        : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500'
                    )}
                  >
                    无异常
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-300">敞口范围</span>
                  <span className="text-xs text-slate-400 font-mono">
                    {(filters.principalRange[0] / 10000).toFixed(0)}万 -{' '}
                    {(filters.principalRange[1] / 10000).toFixed(0)}万
                  </span>
                </div>
                <div className="flex gap-3">
                  <input
                    type="range"
                    min={0}
                    max={maxPrincipal}
                    step={10000}
                    value={filters.principalRange[0]}
                    onChange={(e) =>
                      setFilters({
                        principalRange: [
                          parseInt(e.target.value),
                          filters.principalRange[1],
                        ],
                      })
                    }
                    className="flex-1 accent-cyan-500"
                  />
                  <input
                    type="range"
                    min={0}
                    max={maxPrincipal}
                    step={10000}
                    value={filters.principalRange[1]}
                    onChange={(e) =>
                      setFilters({
                        principalRange: [
                          filters.principalRange[0],
                          parseInt(e.target.value),
                        ],
                      })
                    }
                    className="flex-1 accent-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
