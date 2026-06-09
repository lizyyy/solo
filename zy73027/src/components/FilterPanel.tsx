import { Search, RotateCcw, CalendarDays } from 'lucide-react';
import { useReconciliationStore } from '../store/useReconciliationStore';
import type { StatusFilter } from '../types/reconciliation';

const STATUS_OPTIONS: { value: StatusFilter; label: string; tone: string }[] = [
  { value: 'all', label: '全部', tone: 'neutral' },
  { value: 'confirmed', label: '已确认', tone: 'green' },
  { value: 'pending', label: '待补件', tone: 'orange' },
  { value: 'returned', label: '退回', tone: 'red' },
];

export function FilterPanel() {
  const { filters, setStatusFilter, setDateFrom, setDateTo, setOwnerKeyword, resetFilters } =
    useReconciliationStore();

  const toneClasses = (tone: string, active: boolean) => {
    if (!active) {
      return 'bg-white text-stone-700 border border-stone-300 hover:border-stone-500 hover:bg-stone-50';
    }
    switch (tone) {
      case 'green':
        return 'bg-[#2D6A4F] text-white border border-[#2D6A4F] shadow-md shadow-emerald-900/10';
      case 'orange':
        return 'bg-[#E87722] text-white border border-[#E87722] shadow-md shadow-orange-900/10';
      case 'red':
        return 'bg-[#C1121F] text-white border border-[#C1121F] shadow-md shadow-rose-900/10';
      default:
        return 'bg-stone-800 text-white border border-stone-800 shadow-md shadow-stone-900/10';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 md:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <span className="text-sm font-semibold text-stone-700 tracking-wide shrink-0">
            状态筛选
          </span>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const active = filters.statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-4 py-1.5 rounded-[4px] text-sm font-medium transition-all duration-150 ${toneClasses(
                    opt.tone,
                    active
                  )}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <CalendarDays size={16} className="text-stone-500 shrink-0" />
            <span className="text-sm font-semibold text-stone-700 shrink-0">日期</span>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-[4px] border border-stone-300 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#E87722]/40 focus:border-[#E87722]"
              />
              <span className="text-stone-400 text-sm">至</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-[4px] border border-stone-300 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#E87722]/40 focus:border-[#E87722]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-stone-500 shrink-0" />
            <input
              type="text"
              value={filters.ownerKeyword}
              onChange={(e) => setOwnerKeyword(e.target.value)}
              placeholder="搜索主人昵称..."
              className="flex-1 px-3 py-1.5 rounded-[4px] border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#E87722]/40 focus:border-[#E87722]"
            />
          </div>

          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-sm font-medium border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100 hover:border-stone-400 transition-all duration-150 shrink-0"
          >
            <RotateCcw size={14} />
            重置
          </button>
        </div>
      </div>
    </div>
  );
}
