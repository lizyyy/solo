import { Search, X } from 'lucide-react';
import { useMemo } from 'react';
import { selectFilteredSamples, useSampleStore } from '../store/useSampleStore';
import type { StatusFilter } from '../types';

const FILTERS: StatusFilter[] = ['全部', '异常', '空集合', '重复', '待确认', '可放行'];

const activeStyle: Record<StatusFilter, string> = {
  全部: 'bg-ink-900 text-white border-ink-900',
  异常: 'bg-coral-500 text-white border-coral-500',
  空集合: 'bg-ink-700 text-white border-ink-700',
  重复: 'bg-amber2-500 text-white border-amber2-500',
  待确认: 'bg-amber2-600 text-white border-amber2-600',
  可放行: 'bg-emerald2-500 text-white border-emerald2-500',
};

export default function FilterToolbar() {
  const active = useSampleStore((s) => s.ui.activeFilter);
  const keyword = useSampleStore((s) => s.ui.searchKeyword);
  const setActive = useSampleStore((s) => s.setActiveFilter);
  const setKeyword = useSampleStore((s) => s.setSearchKeyword);
  const samples = useSampleStore((s) => s.samples);

  const count = useMemo(
    () => selectFilteredSamples(samples, active, keyword).length,
    [samples, active, keyword],
  );

  return (
    <div className="card p-3 flex flex-col md:flex-row md:items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索学号、姓名、题目…"
          className="input pl-9 pr-9"
        />
        {keyword && (
          <button
            onClick={() => setKeyword('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1"
            aria-label="清除"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActive(f)}
            className={`chip transition-all ${
              active === f
                ? activeStyle[f]
                : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400 hover:bg-ink-50'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-1 text-xs text-ink-500">
          当前 <b className="text-ink-900">{count}</b> 条
        </span>
      </div>
    </div>
  );
}
