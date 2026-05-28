import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Search, RotateCcw } from "lucide-react";
import { useTermWallStore } from "@/store/useTermWallStore";

const ALL_MONTHS = [
  "2501", "2502", "2503", "2504",
  "2505", "2506", "2507", "2508",
  "2509", "2510", "2511", "2512",
];

export default function FilterPanel() {
  const { positions, filter, setFilter, resetFilter, filterPanelOpen, toggleFilterPanel } =
    useTermWallStore();

  const varieties = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of positions) {
      if (!map.has(p.varietyCode)) {
        map.set(p.varietyCode, p.varietyName ?? p.varietyCode);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [positions]);

  const usedMonths = useMemo(() => {
    const set = new Set<string>();
    for (const p of positions) {
      if (p.contractMonth) set.add(p.contractMonth);
    }
    return ALL_MONTHS.filter((m) => set.has(m));
  }, [positions]);

  if (!filterPanelOpen) {
    return (
      <div className="flex flex-col items-center py-4 w-10 bg-[#111827] border-r border-[#1e293b]">
        <button onClick={toggleFilterPanel} className="text-slate-400 hover:text-white p-1">
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  const toggleVariety = (code: string) => {
    const next = filter.varieties.includes(code)
      ? filter.varieties.filter((v) => v !== code)
      : [...filter.varieties, code];
    setFilter({ varieties: next });
  };

  const toggleMonth = (m: string) => {
    const next = filter.months.includes(m)
      ? filter.months.filter((x) => x !== m)
      : [...filter.months, m];
    setFilter({ months: next });
  };

  const toggleDirection = (d: "long" | "short" | "missing") => {
    const next = filter.directions.includes(d)
      ? filter.directions.filter((x) => x !== d)
      : [...filter.directions, d];
    setFilter({ directions: next });
  };

  return (
    <div className="w-64 bg-[#111827] border-r border-[#1e293b] flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-3 border-b border-[#1e293b]">
        <span className="text-sm font-medium text-slate-300">筛选条件</span>
        <button onClick={toggleFilterPanel} className="text-slate-400 hover:text-white p-1">
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="px-3 py-3 space-y-4 flex-1">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">品种筛选</div>
          <div className="flex flex-wrap gap-1.5">
            {varieties.map(([code, name]) => {
              const active = filter.varieties.includes(code);
              return (
                <button
                  key={code}
                  onClick={() => toggleVariety(code)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-[#1e293b] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {code} {name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">月份范围</div>
          <div className="grid grid-cols-4 gap-1">
            {usedMonths.map((m) => {
              const active = filter.months.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className={`w-full aspect-square rounded text-xs flex items-center justify-center transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-[#1e293b] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {m.slice(2)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">多空方向</div>
          <div className="flex gap-2">
            <button
              onClick={() => toggleDirection("long")}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                filter.directions.includes("long")
                  ? "bg-[#ff6b35] text-white"
                  : "bg-[#1e293b] text-slate-400 hover:text-slate-200"
              }`}
            >
              多头
            </button>
            <button
              onClick={() => toggleDirection("short")}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                filter.directions.includes("short")
                  ? "bg-[#00d4aa] text-white"
                  : "bg-[#1e293b] text-slate-400 hover:text-slate-200"
              }`}
            >
              空头
            </button>
            <button
              onClick={() => toggleDirection("missing")}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                filter.directions.includes("missing")
                  ? "bg-slate-500 text-white"
                  : "bg-[#1e293b] text-slate-400 hover:text-slate-200"
              }`}
            >
              缺失
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">客户搜索</div>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filter.clientSearch}
              onChange={(e) => setFilter({ clientSearch: e.target.value })}
              placeholder="输入客户名称"
              className="w-full bg-[#1e293b] border border-[#2d3548] rounded pl-7 pr-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="px-3 py-3 border-t border-[#1e293b]">
        <button
          onClick={resetFilter}
          className="w-full py-1.5 rounded border border-red-500 text-red-400 text-xs hover:bg-red-500/10 flex items-center justify-center gap-1.5"
        >
          <RotateCcw size={12} />
          重置筛选
        </button>
      </div>
    </div>
  );
}
