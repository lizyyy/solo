import type { ChecklistStatus } from "shared/types";
import { STATUS_LABEL } from "shared/types";
import { useChecklistStore } from "@/store/useChecklistStore";
import { cn } from "@/lib/utils";

type TabKey = "all" | ChecklistStatus;

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "confirmed", label: STATUS_LABEL.confirmed },
  { key: "pending", label: STATUS_LABEL.pending },
  { key: "returned", label: STATUS_LABEL.returned },
  { key: "suspended", label: STATUS_LABEL.suspended },
];

export default function FilterTabs() {
  const { checklists, statusFilter, setFilter } = useChecklistStore();

  const counts: Record<TabKey, number> = {
    all: checklists.length,
    confirmed: 0,
    pending: 0,
    returned: 0,
    suspended: 0,
  };

  checklists.forEach((c) => {
    counts[c.status] += 1;
  });

  return (
    <div className="border-b border-ink-200 bg-white">
      <div className="container mx-auto px-4">
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                  "focus:outline-none",
                  active
                    ? "text-brand-600"
                    : "text-ink-500 hover:text-ink-700"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs",
                    active
                      ? "bg-brand-600 text-white"
                      : "bg-ink-100 text-ink-600"
                  )}
                >
                  {counts[tab.key]}
                </span>
                {active && (
                  <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-brand-600" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
