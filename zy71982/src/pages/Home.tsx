import { useState, useEffect } from "react";
import { useQueueStore } from "@/store/useQueueStore";
import FilterPanel from "@/components/FilterPanel";
import EventTable from "@/components/EventTable";
import ImportModal from "@/components/ImportModal";
import ExportModal from "@/components/ExportModal";
import { Upload, Database, RefreshCw } from "lucide-react";

export default function Home() {
  const { events, initMockData } = useQueueStore();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (events.length === 0) {
      initMockData();
    }
  }, [events.length, initMockData]);

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="h-14 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-amber-500" />
          <h1 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            Webhook 补偿队列
          </h1>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {events.length} 条事件
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={initMockData}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
            title="重新生成模拟数据"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重置数据
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            导入清单
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <FilterPanel />
        <EventTable onExport={() => setExportOpen(true)} />
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
