import { Search, X, Filter } from "lucide-react";
import type { FilterOptions, RecordStatus } from "@/types";

interface Props {
  filter: FilterOptions;
  onChange: (f: FilterOptions) => void;
  batchNos: string[];
  operators: string[];
  showStatus?: boolean;
  showLateToggle?: boolean;
  compact?: boolean;
}

const STATUS_OPTIONS: { value: RecordStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待确认" },
  { value: "confirmed", label: "已确认" },
  { value: "revoked", label: "已撤回" },
];

const LATE_OPTIONS: {
  value: boolean | "all";
  label: string;
  cls: string;
}[] = [
  { value: "all", label: "是否晚到：全部", cls: "chip-neutral" },
  { value: false, label: "正常结果", cls: "chip-moss" },
  { value: true, label: "仅晚到变更", cls: "chip-ember" },
];

export const FilterBar = ({
  filter,
  onChange,
  batchNos,
  operators,
  showStatus = true,
  showLateToggle = true,
  compact = false,
}: Props) => {
  const toggle = <K extends keyof FilterOptions>(
    key: K,
    val: FilterOptions[K] | undefined
  ) => onChange({ ...filter, [key]: val });

  const hasAny = Object.values(filter).some(
    (v) => v !== undefined && v !== "all" && String(v).trim() !== ""
  );

  return (
    <div
      className={`card px-4 py-3 ${
        compact ? "text-xs" : "text-sm"
      } animate-fadeIn`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-ink-500 mr-1">
          <Filter size={14} />
          <span className={compact ? "text-xs" : "text-sm"}>筛选</span>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            value={filter.keyword || ""}
            onChange={(e) => toggle("keyword", e.target.value || undefined)}
            placeholder="搜索标题/内容/备注/编号..."
            className="input !py-1.5 !pl-8 text-sm"
          />
        </div>

        <input
          value={filter.materialNo || ""}
          onChange={(e) => toggle("materialNo", e.target.value || undefined)}
          placeholder="材料编号"
          className="input !py-1.5 !w-36 text-sm font-mono"
        />

        <select
          value={filter.batchNo || ""}
          onChange={(e) => toggle("batchNo", e.target.value || undefined)}
          className="input !py-1.5 !w-44 text-sm"
        >
          <option value="">全部批次号</option>
          {batchNos.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={filter.operator || ""}
          onChange={(e) => toggle("operator", e.target.value || undefined)}
          className="input !py-1.5 !w-32 text-sm"
        >
          <option value="">全部操作人</option>
          {operators.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        {!compact && (
          <>
            <input
              type="date"
              value={filter.dateFrom || ""}
              onChange={(e) =>
                toggle("dateFrom", e.target.value || undefined)
              }
              className="input !py-1.5 !w-36 text-sm"
            />
            <input
              type="date"
              value={filter.dateTo || ""}
              onChange={(e) => toggle("dateTo", e.target.value || undefined)}
              className="input !py-1.5 !w-36 text-sm"
            />
          </>
        )}

        {showStatus && (
          <div className="flex items-center gap-1">
            {STATUS_OPTIONS.map((opt) => {
              const active = (filter.status || "all") === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() =>
                    toggle("status", opt.value === "all" ? undefined : opt.value)
                  }
                  className={`chip transition-all ${
                    active
                      ? "!bg-ink !text-white !border-ink"
                      : "chip-neutral hover:!border-ink-200"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {showLateToggle && (
          <div className="flex items-center gap-1 ml-auto">
            {LATE_OPTIONS.map((opt) => {
              const active =
                (filter.isLateChange ?? "all") === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  onClick={() =>
                    toggle(
                      "isLateChange",
                      opt.value === "all" ? undefined : opt.value
                    )
                  }
                  className={`${opt.cls} transition-all ${
                    active ? "!ring-2 !ring-offset-1 !ring-current" : ""
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {hasAny && (
          <button
            onClick={() => onChange({})}
            className="btn-ghost !text-xs !py-1 ml-1"
            title="清除所有筛选条件"
          >
            <X size={13} /> 清除
          </button>
        )}
      </div>
    </div>
  );
};
