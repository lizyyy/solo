import type { FilterTab } from '../types/review';
import { FILTER_LABEL } from '../utils/statusMappings';

interface Props {
  value: FilterTab;
  onChange: (v: FilterTab) => void;
  counts?: Partial<Record<FilterTab, number>>;
}

const ALL_TABS: FilterTab[] = [
  'all',
  'confirmed',
  'pending-material',
  'returned',
  'late-attachment',
  'layer-issue',
];

export function FilterTabs({ value, onChange, counts }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ALL_TABS.map((tab) => {
      const active = tab === value;
      const count = counts?.[tab];
      return (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`tab flex items-center gap-2 ${active ? 'tab-active' : 'tab-inactive'}`}
        >
          <span>{FILTER_LABEL[tab]}</span>
          {typeof count === 'number' && (
            <span
              className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {count}
            </span>
          )}
        </button>
      );
    })}
    </div>
  );
}
