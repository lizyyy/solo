import { Filter, RotateCcw, Search, Calendar, Tag } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { SampleStatus } from '@/types';
import { cn } from '@/lib/utils';

const statusOptions: { value: SampleStatus; label: string; color: string }[] = [
  { value: 'normal', label: '正常', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'abnormal', label: '异常', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'duplicate', label: '重复', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'pending', label: '待确认', color: 'bg-sky-100 text-sky-700 border-sky-200' },
];

export function Sidebar() {
  const {
    paramVersions,
    currentParamVersionId,
    filters,
    setCurrentParamVersion,
    setFilters,
    resetFilters,
    getCurrentParamVersion,
  } = useAppStore();

  const currentVersion = getCurrentParamVersion();

  const toggleStatus = (status: SampleStatus) => {
    const current = filters.status;
    const newStatus = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setFilters({ status: newStatus });
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.sampleCode !== '' ||
    filters.dateRange !== null;

  return (
    <aside className="flex h-full w-72 flex-col gap-6 border-r border-slate-200 bg-white p-5">
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Tag size={16} />
          参数版本
        </h2>
        <div className="space-y-2">
          {paramVersions.map((version) => (
            <button
              key={version.id}
              onClick={() => setCurrentParamVersion(version.id)}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition-all',
                currentParamVersionId === version.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              )}
            >
              <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{version.name}</span>
              <span className="text-xs text-slate-500">阈值 {version.threshold}%</span>
            </div>
            <div className="mt-1 font-mono text-xs text-slate-500">{version.formula}</div>
            <div className="mt-2 text-xs text-slate-600">{version.description}</div>
          </button>
          ))}
        </div>
      </div>

      {currentVersion && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-medium text-slate-700">当前参数值</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white p-2">
              <div className="text-xs text-slate-500">A</div>
              <div className="font-mono text-sm font-semibold text-slate-800">
                {currentVersion.params.a}
              </div>
            </div>
            <div className="rounded-lg bg-white p-2">
              <div className="text-xs text-slate-500">B</div>
              <div className="font-mono text-sm font-semibold text-slate-800">
                {currentVersion.params.b}
              </div>
            </div>
            <div className="rounded-lg bg-white p-2">
              <div className="text-xs text-slate-500">C</div>
              <div className="font-mono text-sm font-semibold text-slate-800">
                {currentVersion.params.c}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-px bg-slate-200" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Filter size={16} />
            筛选条件
          </h2>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"
            >
              <RotateCcw size={12} />
              重置
            </button>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">样本编号</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.sampleCode}
              onChange={(e) => setFilters({ sampleCode: e.target.value })}
              placeholder="输入样本编号..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">状态筛选</label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
              key={option.value}
              onClick={() => toggleStatus(option.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                filters.status.includes(option.value)
                  ? option.color
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              )}
            >
              {option.label}
            </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
            <Calendar size={12} />
            日期范围
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.dateRange?.[0] || ''}
              onChange={(e) =>
                setFilters({
                  dateRange: [e.target.value, filters.dateRange?.[1] || e.target.value],
                })
              }
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <span className="self-center text-xs text-slate-400">至</span>
            <input
              type="date"
              value={filters.dateRange?.[1] || ''}
              onChange={(e) =>
                setFilters({
                  dateRange: [filters.dateRange?.[0] || e.target.value, e.target.value],
                })
              }
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
