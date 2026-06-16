import { useStore } from "@/store/useStore";
import { Search, X, RotateCcw } from "lucide-react";
import type { IssueType } from "@/types";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "valid", label: "有效" },
  { value: "expired", label: "已过期" },
  { value: "missing", label: "缺授权" },
  { value: "unknown", label: "未确认" },
];

const ISSUE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: "expired", label: "授权过期" },
  { value: "timecode", label: "时码错位" },
  { value: "duplicate", label: "重复曲目" },
];

export default function FilterToolbar() {
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const resetFilter = useStore((s) => s.resetFilter);
  const records = useStore((s) => s.records);

  const toggleStatus = (val: string) => {
    const current = filter.authorizationStatus;
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val];
    setFilter({ authorizationStatus: next });
  };

  const toggleIssue = (val: IssueType) => {
    const current = filter.issueTypes;
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val];
    setFilter({ issueTypes: next });
  };

  const hasFilter =
    filter.authorizationStatus.length > 0 ||
    filter.issueTypes.length > 0 ||
    filter.dateRange.start ||
    filter.dateRange.end ||
    filter.keyword.trim();

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span>授权状态:</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                filter.authorizationStatus.includes(opt.value)
                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500"
              }`}
              onClick={() => toggleStatus(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-zinc-700" />

        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span>问题类型:</span>
          {ISSUE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                filter.issueTypes.includes(opt.value)
                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500"
              }`}
              onClick={() => toggleIssue(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {hasFilter && (
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            onClick={resetFilter}
          >
            <RotateCcw className="w-3 h-3" />
            重置
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span>到期区间:</span>
          <input
            type="date"
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:border-amber-400/60 focus:outline-none"
            value={filter.dateRange.start || ""}
            onChange={(e) =>
              setFilter({ dateRange: { ...filter.dateRange, start: e.target.value || null } })
            }
          />
          <span className="text-zinc-600">~</span>
          <input
            type="date"
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:border-amber-400/60 focus:outline-none"
            value={filter.dateRange.end || ""}
            onChange={(e) =>
              setFilter({ dateRange: { ...filter.dateRange, end: e.target.value || null } })
            }
          />
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="搜索曲目名、文件名、备注..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded pl-8 pr-8 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none"
            value={filter.keyword}
            onChange={(e) => setFilter({ keyword: e.target.value })}
          />
          {filter.keyword && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              onClick={() => setFilter({ keyword: "" })}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <span className="text-xs text-zinc-500 ml-auto">
          共 {records.length} 条记录
        </span>
      </div>
    </div>
  );
}
