import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { SourceType, AnomalyType } from '@/types';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

const SOURCE_OPTIONS: SourceType[] = ['GIS', '巡检', 'Excel'];
const ANOMALY_OPTIONS: AnomalyType[] = ['正常', '空值', '重复', '边界'];

const SOURCE_COLORS: Record<SourceType, string> = {
  GIS: 'bg-cyan-600',
  巡检: 'bg-amber-600',
  Excel: 'bg-emerald-600',
};

const ANOMALY_COLORS: Record<AnomalyType, string> = {
  正常: 'text-cyan-400 border-cyan-400/30',
  空值: 'text-yellow-400 border-yellow-400/30',
  重复: 'text-orange-400 border-orange-400/30',
  边界: 'text-red-400 border-red-400/30',
};

export default function FilterPanel() {
  const { filter, setFilter, resetFilter, filteredRecords, records } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  const toggleSource = (src: SourceType) => {
    const current = filter.sources;
    const next = current.includes(src)
      ? current.filter((s) => s !== src)
      : [...current, src];
    if (next.length > 0) setFilter({ sources: next as SourceType[] });
  };

  const toggleAnomaly = (a: AnomalyType) => {
    const current = filter.anomalyTypes;
    const next = current.includes(a)
      ? current.filter((t) => t !== a)
      : [...current, a];
    if (next.length > 0) setFilter({ anomalyTypes: next as AnomalyType[] });
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-[#0a1628]/90 border border-cyan-500/20 rounded-lg p-2 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    );
  }

  return (
    <div className="absolute left-0 top-0 bottom-0 w-64 bg-[#0a1628]/95 border-r border-cyan-500/20 z-10 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/10">
        <h3 className="text-sm font-semibold text-cyan-300 tracking-wide">筛选条件</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={resetFilter}
            className="p-1 text-cyan-400/60 hover:text-cyan-400 transition-colors"
            title="重置筛选"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 text-cyan-400/60 hover:text-cyan-400 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-4 flex-1">
        <div>
          <p className="text-xs text-zinc-400 mb-2">数据来源</p>
          <div className="flex flex-wrap gap-2">
            {SOURCE_OPTIONS.map((src) => (
              <button
                key={src}
                onClick={() => toggleSource(src)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  filter.sources.includes(src)
                    ? `${SOURCE_COLORS[src]} text-white shadow-lg`
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-zinc-400 mb-2">异常状态</p>
          <div className="flex flex-wrap gap-2">
            {ANOMALY_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => toggleAnomaly(a)}
                className={`px-3 py-1 rounded text-xs font-medium border transition-all ${
                  filter.anomalyTypes.includes(a)
                    ? ANOMALY_COLORS[a]
                    : 'text-zinc-600 border-zinc-700'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-zinc-400 mb-2">时间范围</p>
          <div className="space-y-1">
            <input
              type="datetime-local"
              value={filter.timeRange[0].slice(0, 16)}
              onChange={(e) =>
                setFilter({ timeRange: [e.target.value, filter.timeRange[1]] })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500/50"
            />
            <input
              type="datetime-local"
              value={filter.timeRange[1].slice(0, 16)}
              onChange={(e) =>
                setFilter({ timeRange: [filter.timeRange[0], e.target.value] })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-cyan-500/10 bg-[#060e1a]">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-400">筛选结果</span>
          <span className="text-cyan-400 font-mono">
            {filteredRecords.length} / {records.length}
          </span>
        </div>
      </div>
    </div>
  );
}
