import { Search, RotateCcw } from "lucide-react";
import { useSettlementStore } from "@/store/settlementStore";
import type { SettlementFilter } from "@/utils/api";

export default function FilterBar() {
  const { filter, setFilter, resetFilter } = useSettlementStore();

  const handleChange = (
    field: keyof SettlementFilter,
    value: string | number | undefined
  ) => {
    setFilter({ [field]: value || undefined, page: 1 });
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            门店名称
          </label>
          <input
            type="text"
            value={filter.store_name || ""}
            onChange={(e) => handleChange("store_name", e.target.value)}
            placeholder="输入门店名称"
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="min-w-[160px]">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            活动名称
          </label>
          <input
            type="text"
            value={filter.activity_name || ""}
            onChange={(e) => handleChange("activity_name", e.target.value)}
            placeholder="输入活动名称"
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="min-w-[130px]">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            结算期间（起）
          </label>
          <input
            type="date"
            value={filter.settlement_period_start || ""}
            onChange={(e) =>
              handleChange("settlement_period_start", e.target.value)
            }
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="min-w-[130px]">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            结算期间（止）
          </label>
          <input
            type="date"
            value={filter.settlement_period_end || ""}
            onChange={(e) =>
              handleChange("settlement_period_end", e.target.value)
            }
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="min-w-[120px]">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            状态
          </label>
          <select
            value={filter.status || ""}
            onChange={(e) =>
              handleChange(
                "status",
                e.target.value as SettlementFilter["status"]
              )
            }
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="">全部状态</option>
            <option value="pending">待确认</option>
            <option value="confirmed">已确认</option>
            <option value="withdrawn">已撤回</option>
            <option value="conflict">异常冲突</option>
          </select>
        </div>

        <div className="min-w-[100px]">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            金额（最小）
          </label>
          <input
            type="number"
            value={filter.amount_min ?? ""}
            onChange={(e) =>
              handleChange("amount_min", e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="最小金额"
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 tabular-nums placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="min-w-[100px]">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">
            金额（最大）
          </label>
          <input
            type="number"
            value={filter.amount_max ?? ""}
            onChange={(e) =>
              handleChange("amount_max", e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="最大金额"
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 tabular-nums placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter({ ...filter })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            <Search className="h-4 w-4" />
            筛选
          </button>
          <button
            onClick={resetFilter}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-700 px-4 text-sm font-medium text-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            <RotateCcw className="h-4 w-4" />
            重置
          </button>
        </div>
      </div>
    </div>
  );
}
