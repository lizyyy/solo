import { Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import { STATUS_LABELS } from "@/types";
import type { EventStatus } from "@/types";
import { PRODUCT_TYPES } from "@/types";

const statusOptions: { value: EventStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value: value as EventStatus,
    label,
  })),
];

const productOptions: { value: string; label: string }[] = [
  { value: "all", label: "全部产品" },
  ...PRODUCT_TYPES.map((t) => ({ value: t, label: t })),
];

const selectClass =
  "rounded-md bg-[#1a1f36] border border-[#3b4263] text-[#f0ece4] text-sm px-3 py-2 focus:outline-none focus:border-[#e8a838] appearance-none cursor-pointer";

export default function FilterBar() {
  const statusFilter = useStore((s) => s.filters.statusFilter);
  const productFilter = useStore((s) => s.filters.productFilter);
  const searchQuery = useStore((s) => s.filters.searchQuery);
  const setStatusFilter = useStore((s) => s.setStatusFilter);
  const setProductFilter = useStore((s) => s.setProductFilter);
  const setSearchQuery = useStore((s) => s.setSearchQuery);

  return (
    <div className="flex items-center gap-4">
      <select
        value={statusFilter}
        onChange={(e) =>
          setStatusFilter(e.target.value as EventStatus | "all")
        }
        className={selectClass}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={productFilter}
        onChange={(e) => setProductFilter(e.target.value)}
        className={selectClass}
      >
        {productOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="relative flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7894]"
        />
        <input
          type="text"
          placeholder="搜索事件编号、名称、标的实体..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md bg-[#1a1f36] border border-[#3b4263] text-[#f0ece4] text-sm pl-9 pr-3 py-2 focus:outline-none focus:border-[#e8a838] placeholder:text-[#6b7894]"
        />
      </div>
    </div>
  );
}
