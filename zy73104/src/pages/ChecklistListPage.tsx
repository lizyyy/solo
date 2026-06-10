import { useEffect, useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import FilterTabs from "@/components/FilterTabs";
import ChecklistCard from "@/components/ChecklistCard";
import Empty from "@/components/Empty";
import { useChecklistStore } from "@/store/useChecklistStore";

export default function ChecklistListPage() {
  const { checklists, statusFilter, loading, fetchChecklists } = useChecklistStore();

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const filteredChecklists = useMemo(() => {
    if (statusFilter === "all") return checklists;
    return checklists.filter((c) => c.status === statusFilter);
  }, [checklists, statusFilter]);

  return (
    <div className="min-h-screen flex flex-col bg-ink-50">
      <AppHeader />
      <FilterTabs />

      <main className="flex-1 container mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-4 w-20 bg-ink-200 rounded" />
                  <div className="h-6 w-16 bg-ink-200 rounded-full" />
                </div>
                <div className="h-6 w-3/4 bg-ink-200 rounded mb-3" />
                <div className="h-4 w-1/2 bg-ink-200 rounded mb-4" />
                <div className="h-6 w-20 bg-ink-200 rounded-full mb-3" />
                <div className="h-4 w-full bg-ink-100 rounded" />
              </div>
            ))}
          </div>
        ) : filteredChecklists.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChecklists.map((checklist) => (
              <ChecklistCard key={checklist.id} checklist={checklist} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
