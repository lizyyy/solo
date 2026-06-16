import { useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ISSUE_TYPE_LABELS } from '@/types';

const TIME_PERIODS = ['早高峰', '平峰', '晚高峰'];
const SOURCES = ['调度系统', '人工记录', '旧台账'];
const ISSUE_TYPES: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  ...Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => ({
    value: k,
    label: v,
  })),
];

export default function FilterPanel() {
  const samples = useStore((s) => s.samples);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const caliberLabel = useStore((s) => s.caliberLabel);

  const lineOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of samples) {
      if (!seen.has(s.lineId)) seen.set(s.lineId, s.lineName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [samples]);

  function handleReset() {
    setFilter({
      lineId: '',
      timePeriod: '',
      dateRange: ['', ''],
      source: '',
      issueType: '',
    });
  }

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-200 sticky top-0 h-screen overflow-y-auto">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter className="w-4 h-4" />
          筛选条件
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">线路</label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            value={filter.lineId}
            onChange={(e) => setFilter({ lineId: e.target.value })}
          >
            <option value="">全部线路</option>
            {lineOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">时段</label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            value={filter.timePeriod}
            onChange={(e) => setFilter({ timePeriod: e.target.value })}
          >
            <option value="">全部时段</option>
            {TIME_PERIODS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">日期范围</label>
          <div className="space-y-1">
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              value={filter.dateRange[0]}
              onChange={(e) =>
                setFilter({ dateRange: [e.target.value, filter.dateRange[1]] })
              }
            />
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              value={filter.dateRange[1]}
              onChange={(e) =>
                setFilter({ dateRange: [filter.dateRange[0], e.target.value] })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">来源</label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            value={filter.source}
            onChange={(e) => setFilter({ source: e.target.value })}
          >
            <option value="">全部来源</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">问题类型</label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            value={filter.issueType}
            onChange={(e) => setFilter({ issueType: e.target.value })}
          >
            {ISSUE_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">当前口径</label>
          <span className="inline-block rounded-full bg-teal-50 text-teal-700 text-xs font-medium px-3 py-1 border border-teal-200">
            {caliberLabel}
          </span>
        </div>

        <button
          className="w-full flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={handleReset}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重置筛选
        </button>
      </div>
    </aside>
  );
}
