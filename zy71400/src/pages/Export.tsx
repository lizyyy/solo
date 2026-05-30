import { useEffect } from "react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

const statusLabels: Record<string, string> = {
  draft: "草稿",
  processed: "已处理",
  reviewed: "已复核",
  exported: "已导出",
};

export default function ExportPage() {
  const {
    currentBatchId,
    batches,
    trades,
    collaterals,
    rates,
    results,
    reviews,
    fetchTrades,
    fetchCollaterals,
    fetchRates,
    fetchResults,
    fetchReviews,
    exportBatch,
  } = useStore();

  const currentBatch = batches.find((b) => b.id === currentBatchId);

  useEffect(() => {
    if (currentBatchId) {
      fetchTrades(currentBatchId);
      fetchCollaterals(currentBatchId);
      fetchRates(currentBatchId);
      fetchResults(currentBatchId);
      fetchReviews(currentBatchId);
    }
  }, [currentBatchId, fetchTrades, fetchCollaterals, fetchRates, fetchResults, fetchReviews]);

  if (!currentBatchId || !currentBatch) {
    return <div className="py-20 text-center text-brand-text-secondary">请先从首页选择一个批次</div>;
  }

  const handleExport = () => {
    exportBatch(currentBatchId);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-text-primary">数据导出</h1>
        <p className="mt-1 text-sm text-brand-text-secondary">导出批次折算结果为 CSV 文件</p>
      </div>

      <div className="mb-6 rounded-lg border border-slate-700 bg-brand-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-brand-text-primary">批次概要</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-text-secondary">批次名称</span>
            <span className="font-mono-data text-brand-text-primary">{currentBatch.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-text-secondary">日期</span>
            <span className="font-mono-data text-brand-text-primary">{currentBatch.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-text-secondary">状态</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                currentBatch.status === "exported"
                  ? "bg-amber-600/30 text-amber-400"
                  : currentBatch.status === "reviewed"
                  ? "bg-emerald-600/30 text-emerald-400"
                  : currentBatch.status === "processed"
                  ? "bg-blue-600/30 text-blue-400"
                  : "bg-slate-600 text-slate-100"
              )}
            >
              {statusLabels[currentBatch.status] || currentBatch.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-text-secondary">创建时间</span>
            <span className="font-mono-data text-brand-text-primary">
              {new Date(currentBatch.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-slate-900 p-3 text-center">
            <p className="text-xs text-brand-text-secondary">交易笔数</p>
            <p className="mt-1 font-mono-data text-xl font-bold text-brand-info">{trades.length}</p>
          </div>
          <div className="rounded-lg bg-slate-900 p-3 text-center">
            <p className="text-xs text-brand-text-secondary">质押券数</p>
            <p className="mt-1 font-mono-data text-xl font-bold text-brand-warning">{collaterals.length}</p>
          </div>
          <div className="rounded-lg bg-slate-900 p-3 text-center">
            <p className="text-xs text-brand-text-secondary">折算率数</p>
            <p className="mt-1 font-mono-data text-xl font-bold text-brand-success">{rates.length}</p>
          </div>
          <div className="rounded-lg bg-slate-900 p-3 text-center">
            <p className="text-xs text-brand-text-secondary">复核进度</p>
            <p className="mt-1 font-mono-data text-xl font-bold text-brand-text-primary">
              {reviews.filter((r) => r.status === "已复核").length}/{results.length}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-md bg-brand-warning px-5 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400"
        >
          <Download size={16} />
          导出 CSV
        </button>
        <span className="text-xs text-brand-text-secondary">
          导出后批次状态将变更为「已导出」
        </span>
      </div>
    </div>
  );
}
