import { Filter, AlertTriangle, RotateCcw } from 'lucide-react';
import type { FilterState, SourceType } from '@/types';
import { useAppStore, useFilteredData } from '@/store/appStore';

const sourceTypeLabels: Record<SourceType, string> = {
  gis: 'GIS',
  inspection: '巡检平板',
  excel: 'Excel',
  manual: '手动',
};

interface FilterBarProps {
  filters: FilterState
  onChange: (filters: Partial<FilterState>) => void
  onReset: () => void
}

export default function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const data = useAppStore(s => s.data);
  const filtered = useFilteredData();
  const anomalyCount = data.filter(r => r.anomaly.isAnomaly).length;

  return (
    <div className="bg-[#1a1f36]/95 border-b border-slate-700/50 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Filter size={13} />
          筛选条件：
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Δ</span>
          <input
            type="number"
            step="0.1"
            value={filters.deltaRange[0]}
            onChange={e => onChange({ deltaRange: [Number(e.target.value), filters.deltaRange[1]] })}
            className="w-16 bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
          />
          <span className="text-slate-500 text-xs">~</span>
          <input
            type="number"
            step="0.1"
            value={filters.deltaRange[1]}
            onChange={e => onChange({ deltaRange: [filters.deltaRange[0], Number(e.target.value)] })}
            className="w-16 bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Γ</span>
          <input
            type="number"
            step="0.1"
            value={filters.gammaRange[0]}
            onChange={e => onChange({ gammaRange: [Number(e.target.value), filters.gammaRange[1]] })}
            className="w-16 bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
          />
          <span className="text-slate-500 text-xs">~</span>
          <input
            type="number"
            step="0.1"
            value={filters.gammaRange[1]}
            onChange={e => onChange({ gammaRange: [filters.gammaRange[0], Number(e.target.value)] })}
            className="w-16 bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">ν</span>
          <input
            type="number"
            step="10"
            value={filters.vegaRange[0]}
            onChange={e => onChange({ vegaRange: [Number(e.target.value), filters.vegaRange[1]] })}
            className="w-16 bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
          />
          <span className="text-slate-500 text-xs">~</span>
          <input
            type="number"
            step="10"
            value={filters.vegaRange[1]}
            onChange={e => onChange({ vegaRange: [filters.vegaRange[0], Number(e.target.value)] })}
            className="w-16 bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          {(Object.keys(sourceTypeLabels) as SourceType[]).map(type => (
            <button
              key={type}
              onClick={() => {
                const current = filters.sourceTypes;
                const next = current.includes(type)
                  ? current.filter(t => t !== type)
                  : [...current, type];
                onChange({ sourceTypes: next });
              }}
              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                filters.sourceTypes.includes(type)
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-slate-800/50 text-slate-500 border-slate-700/30 hover:text-slate-300'
              }`}
            >
              {sourceTypeLabels[type]}
            </button>
          ))}
        </div>

        <button
          onClick={() => onChange({ anomalyOnly: !filters.anomalyOnly })}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded border transition-all ${
            filters.anomalyOnly
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-slate-800/50 text-slate-400 border-slate-700/30 hover:text-white'
          }`}
        >
          <AlertTriangle size={11} />
          仅看异常
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-all"
        >
          <RotateCcw size={11} />
          重置
        </button>

        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span className="text-slate-500">
            显示 <span className="text-cyan-400 font-mono">{filtered.length}</span> / {data.length}
          </span>
          <span className="text-slate-500">
            异常 <span className="text-red-400 font-mono">{anomalyCount}</span>
          </span>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-slate-500 font-mono">
        当前筛选条件：Δ∈[{filters.deltaRange[0].toFixed(1)}, {filters.deltaRange[1].toFixed(1)}] · Γ∈[{filters.gammaRange[0].toFixed(1)}, {filters.gammaRange[1].toFixed(1)}] · ν∈[{filters.vegaRange[0].toFixed(0)}, {filters.vegaRange[1].toFixed(0)}] · 来源：{filters.sourceTypes.map(t => sourceTypeLabels[t]).join('/')} {filters.anomalyOnly && '· 仅异常'}
      </div>
    </div>
  );
}
