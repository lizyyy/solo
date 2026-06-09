import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import {
  PET_CATEGORY_LABEL,
  STATUS_LABEL,
  ANOMALY_LABEL,
  type PetCategory,
  type RecordStatus,
  type AnomalyType,
  type FilterState,
} from '@/types';

type FilterOption<T extends string> = {
  value: T | 'all';
  label: string;
  accent?: string;
};

const CATEGORY_OPTIONS: FilterOption<PetCategory>[] = [
  { value: 'all', label: '全部' },
  { value: 'reptile', label: PET_CATEGORY_LABEL.reptile, accent: 'border-emerald-400 text-emerald-700 bg-emerald-50' },
  { value: 'bird', label: PET_CATEGORY_LABEL.bird, accent: 'border-sky-400 text-sky-700 bg-sky-50' },
  { value: 'smallMammal', label: PET_CATEGORY_LABEL.smallMammal, accent: 'border-amber-400 text-amber-700 bg-amber-50' },
  { value: 'other', label: PET_CATEGORY_LABEL.other, accent: 'border-slate-400 text-slate-700 bg-slate-50' },
];

const STATUS_OPTIONS: FilterOption<RecordStatus>[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: STATUS_LABEL.pending, accent: 'border-ink-400 text-ink-700 bg-ink-50' },
  { value: 'confirmed', label: STATUS_LABEL.confirmed, accent: 'border-emerald-400 text-emerald-700 bg-emerald-50' },
  { value: 'anomaly', label: STATUS_LABEL.anomaly, accent: 'border-rose-400 text-rose-700 bg-rose-50' },
];

const ANOMALY_OPTIONS: FilterOption<AnomalyType>[] = [
  { value: 'all', label: '全部' },
  { value: 'weight_unit_mixed', label: ANOMALY_LABEL.weight_unit_mixed, accent: 'border-red-400 text-red-700 bg-red-50' },
  { value: 'duplicate_pet', label: ANOMALY_LABEL.duplicate_pet, accent: 'border-violet-400 text-violet-700 bg-violet-50' },
  { value: 'temp_out_of_range', label: ANOMALY_LABEL.temp_out_of_range, accent: 'border-orange-400 text-orange-700 bg-orange-50' },
  { value: 'missing_data', label: ANOMALY_LABEL.missing_data, accent: 'border-slate-400 text-slate-700 bg-slate-50' },
  { value: 'wechat_note_flag', label: ANOMALY_LABEL.wechat_note_flag, accent: 'border-amber-400 text-amber-700 bg-amber-50' },
];

const WEIGHT_OPTIONS: FilterOption<'abnormal' | 'normal'>[] = [
  { value: 'all', label: '全部' },
  { value: 'abnormal', label: '仅异常', accent: 'border-rose-400 text-rose-700 bg-rose-50' },
  { value: 'normal', label: '仅正常', accent: 'border-emerald-400 text-emerald-700 bg-emerald-50' },
];

const DUPLICATE_OPTIONS: FilterOption<'yes' | 'no'>[] = [
  { value: 'all', label: '全部' },
  { value: 'yes', label: '有', accent: 'border-violet-400 text-violet-700 bg-violet-50' },
  { value: 'no', label: '无', accent: 'border-ink-400 text-ink-700 bg-ink-50' },
];

export default function FilterPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const filterState = useAppStore((s) => s.filterState);
  const setFilter = useAppStore((s) => s.setFilter);

  const hasActiveFilter =
    filterState.category !== 'all' ||
    filterState.status !== 'all' ||
    filterState.anomaly !== 'all' ||
    filterState.weightAbnormal !== 'all' ||
    filterState.hasDuplicate !== 'all' ||
    filterState.search.trim() !== '';

  const activeCount = [
    filterState.category !== 'all',
    filterState.status !== 'all',
    filterState.anomaly !== 'all',
    filterState.weightAbnormal !== 'all',
    filterState.hasDuplicate !== 'all',
    filterState.search.trim() !== '',
  ].filter(Boolean).length;

  const handleReset = () => {
    setFilter({
      category: 'all',
      status: 'all',
      anomaly: 'all',
      weightAbnormal: 'all',
      hasDuplicate: 'all',
      search: '',
    });
  };

  if (collapsed) {
    return (
      <aside className="w-10 flex-shrink-0 h-full bg-white border-r border-ink-200/70 flex flex-col items-center py-3 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded-md flex items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          title="展开筛选面板"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-6 h-px bg-ink-200 my-1" />
        {hasActiveFilter && (
          <div className="relative">
            <Filter className="w-4 h-4 text-clinic-500" />
            <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-1 rounded-full bg-clinic-500 text-white text-[9px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-[260px] flex-shrink-0 h-full bg-white border-r border-ink-200/70 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-ink-200/70">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-clinic-500" />
          <span className="text-sm font-semibold text-ink-700">筛选条件</span>
          {hasActiveFilter && (
            <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-clinic-500 text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
          title="收起筛选面板"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5 scrollbar-thin">
        <FilterGroup label="搜索" noPadding>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
            <input
              type="text"
              placeholder="宠物名/主人/电话/品种"
              value={filterState.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              className="input pl-8 pr-8"
            />
            {filterState.search && (
              <button
                onClick={() => setFilter({ search: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-ink-200 flex items-center justify-center text-ink-500 hover:bg-ink-300 hover:text-ink-700 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </FilterGroup>

        <FilterGroup label="宠物品类">
          <FilterChips
            options={CATEGORY_OPTIONS}
            value={filterState.category}
            onChange={(v) => setFilter({ category: v as PetCategory | 'all' })}
          />
        </FilterGroup>

        <FilterGroup label="处理状态">
          <FilterChips
            options={STATUS_OPTIONS}
            value={filterState.status}
            onChange={(v) => setFilter({ status: v as RecordStatus | 'all' })}
          />
        </FilterGroup>

        <FilterGroup label="异常类型">
          <FilterChips
            options={ANOMALY_OPTIONS}
            value={filterState.anomaly}
            onChange={(v) => setFilter({ anomaly: v as AnomalyType | 'all' })}
          />
        </FilterGroup>

        <FilterGroup label="体重异常">
          <FilterChips
            options={WEIGHT_OPTIONS}
            value={filterState.weightAbnormal}
            onChange={(v) => setFilter({ weightAbnormal: v as FilterState['weightAbnormal'] })}
          />
        </FilterGroup>

        <FilterGroup label="重名标记">
          <FilterChips
            options={DUPLICATE_OPTIONS}
            value={filterState.hasDuplicate}
            onChange={(v) => setFilter({ hasDuplicate: v as FilterState['hasDuplicate'] })}
          />
        </FilterGroup>
      </div>

      <div className="px-3 py-3 border-t border-ink-200/70">
        <AnimatePresence>
          {hasActiveFilter && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              onClick={handleReset}
              className="w-full btn-secondary text-xs justify-center"
            >
              <X className="w-3.5 h-3.5" />
              重置筛选
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function FilterGroup({
  label,
  children,
  noPadding,
}: {
  label: string;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <div className="card-flat">
      <div className="px-3 py-2 border-b border-ink-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-600 tracking-wide">{label}</span>
      </div>
      <div className={cn(noPadding ? 'px-0 py-0' : 'px-3 py-2.5')}>{children}</div>
    </div>
  );
}

function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterOption<T>[];
  value: T | 'all';
  onChange: (v: T | 'all') => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const hasAccent = opt.accent && isSelected;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-2.5 py-1 text-[11.5px] rounded-md border transition-all duration-150 font-medium',
              isSelected
                ? hasAccent
                  ? opt.accent
                  : 'border-clinic-400 bg-clinic-50 text-clinic-700 shadow-sm'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
