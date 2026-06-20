import { X, Search, Filter as FilterIcon } from 'lucide-react';
import type { FilterCriteria, Difficulty, ConstraintType, ReviewStatus } from '@/types';
import { difficultyLabel, constraintTypeLabel, reviewStatusLabel, generateFilterSummary } from '@/services/filterService';

interface FilterBarProps {
  criteria: FilterCriteria;
  onChange: (criteria: Partial<FilterCriteria>) => void;
}

const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
const constraintTypes: ConstraintType[] = ['linear', 'nonlinear', 'integer', 'binary'];
const reviewStatuses: ReviewStatus[] = ['pending', 'normal', 'abnormal', 'unit_issue'];

export default function FilterBar({ criteria, onChange }: FilterBarProps) {
  const summary = generateFilterSummary(criteria);
  const hasActiveFilters =
    criteria.difficulties.length > 0 ||
    criteria.constraintTypes.length > 0 ||
    criteria.reviewStatuses.length > 0 ||
    criteria.showUnitIssuesOnly ||
    criteria.keyword.length > 0;

  const toggleDifficulty = (d: Difficulty) => {
    const exists = criteria.difficulties.includes(d);
    onChange({
      difficulties: exists
        ? criteria.difficulties.filter((x) => x !== d)
        : [...criteria.difficulties, d],
    });
  };

  const toggleConstraintType = (c: ConstraintType) => {
    const exists = criteria.constraintTypes.includes(c);
    onChange({
      constraintTypes: exists
        ? criteria.constraintTypes.filter((x) => x !== c)
        : [...criteria.constraintTypes, c],
    });
  };

  const toggleReviewStatus = (s: ReviewStatus) => {
    const exists = criteria.reviewStatuses.includes(s);
    onChange({
      reviewStatuses: exists
        ? criteria.reviewStatuses.filter((x) => x !== s)
        : [...criteria.reviewStatuses, s],
    });
  };

  const clearAll = () => {
    onChange({
      difficulties: [],
      constraintTypes: [],
      reviewStatuses: [],
      showUnitIssuesOnly: false,
      keyword: '',
    });
  };

  return (
    <div className="card-academic p-5 mb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FilterIcon className="w-4 h-4 text-academic-500" />
          <h3 className="text-sm font-semibold text-academic-700">筛选条件</h3>
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px] rounded-full font-medium">
              已应用
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-academic-500 hover:text-academic-700 flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            清除全部
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-academic-400" />
        <input
          type="text"
          value={criteria.keyword}
          onChange={(e) => onChange({ keyword: e.target.value })}
          placeholder="搜索题目名称、知识点..."
          className="input-field pl-9"
        />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-academic-500 mb-2 font-medium">难度</p>
          <div className="flex flex-wrap gap-2">
            {difficulties.map((d) => {
              const active = criteria.difficulties.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDifficulty(d)}
                  className={active ? 'filter-chip-active' : 'filter-chip'}
                >
                  {difficultyLabel(d)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs text-academic-500 mb-2 font-medium">约束类型</p>
          <div className="flex flex-wrap gap-2">
            {constraintTypes.map((c) => {
              const active = criteria.constraintTypes.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleConstraintType(c)}
                  className={active ? 'filter-chip-active' : 'filter-chip'}
                >
                  {constraintTypeLabel(c)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs text-academic-500 mb-2 font-medium">复核状态</p>
          <div className="flex flex-wrap gap-2">
            {reviewStatuses.map((s) => {
              const active = criteria.reviewStatuses.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleReviewStatus(s)}
                  className={active ? 'filter-chip-active' : 'filter-chip'}
                >
                  {reviewStatusLabel(s)}
                </button>
              );
            })}
            <button
              onClick={() => onChange({ showUnitIssuesOnly: !criteria.showUnitIssuesOnly })}
              className={criteria.showUnitIssuesOnly ? 'filter-chip-active' : 'filter-chip'}
            >
              仅单位问题
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-academic-100 flex items-center gap-2">
        <span className="text-xs font-semibold text-amber-600">筛选口径：</span>
        <span className="text-xs text-academic-600 font-mono">{summary}</span>
      </div>
    </div>
  );
}
