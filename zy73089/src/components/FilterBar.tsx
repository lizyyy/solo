import { Filter, X } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useChecklistStore } from '@/store/checklistStore';
import type { MatchStatus } from '@/shared/types';
import { statusLabel } from '@/utils/diff';

const STATUSES: MatchStatus[] = ['matched', 'mismatched', 'pending'];

export function FilterBar() {
  const filters = useUiStore((s) => s.filters);
  const setFilters = useUiStore((s) => s.setFilters);
  const resetFilters = useUiStore((s) => s.resetFilters);
  const toggleStatusFilter = useUiStore((s) => s.toggleStatusFilter);
  const toggleComponentFilter = useUiStore((s) => s.toggleComponentFilter);

  const components = useChecklistStore((s) => s.modelComponents);
  const visaForms = useChecklistStore((s) => s.visaForms);
  const materials = useChecklistStore((s) => s.materialSubmissions);

  const compList = Object.values(components);
  const visaList = Object.values(visaForms);
  const matList = Object.values(materials);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 pr-2 text-slate-600">
        <Filter className="h-4 w-4" />
        <span className="text-xs font-bold">筛选器</span>
      </div>

      <div className="h-5 w-px bg-slate-200" />

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-slate-500">构件：</span>
        {compList.length === 0 && (
          <span className="text-[11px] text-slate-400 italic">（未加载构件）</span>
        )}
        {compList.map((c) => {
          const on = filters.componentIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleComponentFilter(c.id)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-all ${
                on
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-slate-200" />

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-slate-500">状态：</span>
        {STATUSES.map((st) => {
          const on = filters.statuses.includes(st);
          const color =
            st === 'matched'
              ? 'emerald'
              : st === 'mismatched'
                ? 'orange'
                : 'slate';
          return (
            <button
              key={st}
              onClick={() => toggleStatusFilter(st)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-all ${
                on
                  ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
              style={
                on
                  ? {
                      borderColor:
                        color === 'emerald'
                          ? '#10B981'
                          : color === 'orange'
                            ? '#F97316'
                            : '#64748B',
                      backgroundColor:
                        color === 'emerald'
                          ? '#ECFDF5'
                          : color === 'orange'
                            ? '#FFF7ED'
                            : '#F1F5F9',
                      color:
                        color === 'emerald'
                          ? '#047857'
                          : color === 'orange'
                            ? '#C2410C'
                            : '#334155',
                    }
                  : undefined
              }
            >
              {statusLabel[st]}
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-slate-200" />

      <select
        className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600"
        value={filters.visaNos[0] || ''}
        onChange={(e) => setFilters({ visaNos: e.target.value ? [e.target.value] : [] })}
      >
        <option value="">签证单：全部</option>
        {visaList.map((v) => (
          <option key={v.visaFormId} value={v.visaNo}>
            {v.visaNo.slice(0, 24)}
          </option>
        ))}
      </select>

      <select
        className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600"
        value={filters.materialBatchNos[0] || ''}
        onChange={(e) =>
          setFilters({ materialBatchNos: e.target.value ? [e.target.value] : [] })
        }
      >
        <option value="">材料批号：全部</option>
        {matList.map((m) => (
          <option key={m.materialId} value={m.batchNo}>
            {m.batchNo.slice(0, 24)}
          </option>
        ))}
      </select>

      <div className="ml-auto">
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
        >
          <X className="h-3 w-3" /> 重置
        </button>
      </div>
    </div>
  );
}
