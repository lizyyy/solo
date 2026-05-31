import { useState, useRef, useEffect } from "react";
import { Search, RotateCcw, Download, ChevronDown } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

const statusOptions = [
  { value: "all", label: "全部" },
  { value: "consistent", label: "一致" },
  { value: "inconsistent", label: "不一致" },
  { value: "pending", label: "待确认" },
];

export default function FilterPanel() {
  const { filter, setFilter, resetFilter, exportData, features, loading } =
    useStore();
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        exportRef.current &&
        !exportRef.current.contains(e.target as Node)
      ) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasFilter =
    filter.featureName || filter.status !== "all" || filter.dateFrom || filter.dateTo;

  return (
    <div className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800 px-6 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="特征名称"
            value={filter.featureName}
            onChange={(e) => setFilter({ featureName: e.target.value })}
            className="input-dark pl-8 w-48 text-sm"
          />
        </div>

        <select
          value={filter.status}
          onChange={(e) =>
            setFilter({
              status: e.target.value as FilterState["status"],
            })
          }
          className="input-dark text-sm w-28"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              口径状态: {opt.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-sm">从</span>
          <input
            type="date"
            value={filter.dateFrom || ""}
            onChange={(e) =>
              setFilter({ dateFrom: e.target.value || null })
            }
            className="input-dark text-sm w-36"
          />
          <span className="text-zinc-500 text-sm">到</span>
          <input
            type="date"
            value={filter.dateTo || ""}
            onChange={(e) =>
              setFilter({ dateTo: e.target.value || null })
            }
            className="input-dark text-sm w-36"
          />
        </div>

        {hasFilter && (
          <button onClick={resetFilter} className="btn-ghost text-sm flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" />
            重置
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className={cn("text-sm font-mono-display", loading ? "text-zinc-600" : "text-zinc-400")}>
            显示 {features.length} 条特征
          </span>

          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              导出
              <ChevronDown className="w-3 h-3" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded shadow-xl z-10 overflow-hidden">
                <button
                  onClick={() => {
                    exportData("csv");
                    setExportOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  CSV
                </button>
                <button
                  onClick={() => {
                    exportData("json");
                    setExportOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type FilterState = import("../../shared/types").FilterState;
