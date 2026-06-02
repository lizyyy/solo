import { useStore } from "@/store/useStore";
import { useFilteredRecords, useIssueCounts } from "@/hooks/useDerived";
import { exportCsv } from "@/utils/exportCsv";
import ImportArea from "@/components/ImportArea";
import FilterToolbar from "@/components/FilterToolbar";
import DataTable from "@/components/DataTable";
import IssuePanel from "@/components/IssuePanel";
import DiffLog from "@/components/DiffLog";
import { Download, Trash2, Shield } from "lucide-react";

export default function Home() {
  const clearAll = useStore((s) => s.clearAll);
  const records = useStore((s) => s.records);
  const diffLog = useStore((s) => s.diffLog);
  const filteredRecords = useFilteredRecords();
  const counts = useIssueCounts();

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      alert("当前筛选结果为空，无法导出");
      return;
    }
    exportCsv(filteredRecords);
  };

  const handleClear = () => {
    if (records.length === 0) return;
    const confirmed = window.confirm("确定清除所有数据？此操作不可撤销。");
    if (confirmed) clearAll();
  };

  return (
    <div className="min-h-screen bg-[#12121e] text-zinc-200">
      <header className="sticky top-0 z-30 bg-[#12121e]/90 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-100 tracking-tight">
                采样授权到期提醒
              </h1>
              <p className="text-[10px] text-zinc-500 -mt-0.5">演出统筹 · 阿蓝</p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            {counts.expired > 0 && (
              <span className="text-red-400">
                过期 {counts.expired}
              </span>
            )}
            {counts.timecode > 0 && (
              <span className="text-sky-400">
                时码 {counts.timecode}
              </span>
            )}
            {counts.duplicate > 0 && (
              <span className="text-violet-400">
                重复 {counts.duplicate}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-medium hover:bg-amber-400/25 transition-colors disabled:opacity-40"
              onClick={handleExport}
              disabled={records.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              导出清单
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:text-red-400 hover:border-red-400/40 transition-colors disabled:opacity-40"
              onClick={handleClear}
              disabled={records.length === 0}
            >
              <Trash2 className="w-3.5 h-3.5" />
              清除
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          <aside className="w-[280px] flex-shrink-0">
            <div className="sticky top-[73px]">
              <ImportArea />
              <IssuePanel />
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            <FilterToolbar />
            <DataTable />
            <DiffLog />
          </section>
        </div>

        {records.length === 0 && diffLog.length === 0 && (
          <div className="fixed inset-0 top-[57px] pointer-events-none flex items-center justify-center z-10">
            <div className="text-center pointer-events-auto">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/40 flex items-center justify-center">
                <Shield className="w-9 h-9 text-amber-400/40" />
              </div>
              <p className="text-zinc-500 text-sm mb-1">开始使用</p>
              <p className="text-zinc-600 text-xs">
                从左侧导入音频文件或加载样例数据
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
