import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { Settings, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

export default function Process() {
  const { currentBatchId, batches, results, processBatch, fetchResults } = useStore();
  const [processing, setProcessing] = useState(false);
  const [confirmReprocess, setConfirmReprocess] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState<Set<string>>(new Set());

  const currentBatch = batches.find((b) => b.id === currentBatchId);

  useEffect(() => {
    if (currentBatchId) {
      fetchResults(currentBatchId);
    }
  }, [currentBatchId, fetchResults]);

  if (!currentBatchId || !currentBatch) {
    return <div className="py-20 text-center text-brand-text-secondary">请先从首页选择一个批次</div>;
  }

  const passCount = results.filter((r) => r.conclusion === "通过").length;
  const failCount = results.filter((r) => r.conclusion === "异常").length;

  const handleProcess = async () => {
    if (results.length > 0 && !confirmReprocess) {
      setConfirmReprocess(true);
      return;
    }
    setProcessing(true);
    setConfirmReprocess(false);
    try {
      await processBatch(currentBatchId);
    } finally {
      setProcessing(false);
    }
  };

  const toggleWarning = (id: string) => {
    setExpandedWarnings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-text-primary">折算处理</h1>
          <p className="mt-1 text-sm text-brand-text-secondary">
            批次：{currentBatch.name}
          </p>
        </div>
        <button
          onClick={handleProcess}
          disabled={processing}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            processing
              ? "cursor-not-allowed bg-slate-600 text-slate-400"
              : "bg-brand-warning text-slate-900 hover:bg-amber-400"
          )}
        >
          <Settings size={16} className={cn(processing && "animate-spin")} />
          {processing ? "处理中..." : "执行处理"}
        </button>
      </div>

      {confirmReprocess && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-brand-warning bg-amber-900/20 px-4 py-3">
          <AlertTriangle size={18} className="text-brand-warning" />
          <span className="text-sm text-brand-warning">重新处理将覆盖已有结果，确定继续？</span>
          <button onClick={handleProcess} className="rounded-md bg-brand-warning px-3 py-1 text-xs font-medium text-slate-900 hover:bg-amber-400">确定</button>
          <button onClick={() => setConfirmReprocess(false)} className="rounded-md border border-slate-600 px-3 py-1 text-xs text-brand-text-secondary hover:text-brand-text-primary">取消</button>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-700 bg-brand-card p-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} className="text-brand-success" />
                <span className="text-sm text-brand-text-secondary">通过条数</span>
              </div>
              <p className="mt-2 font-mono-data text-2xl font-bold text-brand-success">{passCount}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-brand-card p-4">
              <div className="flex items-center gap-2">
                <XCircle size={20} className="text-brand-danger" />
                <span className="text-sm text-brand-text-secondary">异常条数</span>
              </div>
              <p className="mt-2 font-mono-data text-2xl font-bold text-brand-danger">{failCount}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="data-table">
              <thead className="bg-slate-800">
                <tr>
                  <th>债券代码</th>
                  <th>折算率(%)</th>
                  <th>折算金额</th>
                  <th>结论</th>
                  <th>异常原因</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.bondCode}</td>
                    <td>{r.discountRate.toFixed(2)}</td>
                    <td>{r.discountAmount.toLocaleString()}</td>
                    <td>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          r.conclusion === "通过"
                            ? "bg-emerald-600/30 text-emerald-400"
                            : "bg-red-600/30 text-red-400"
                        )}
                      >
                        {r.conclusion}
                      </span>
                    </td>
                    <td>
                      {r.warnings.length > 0 ? (
                        <div>
                          <button
                            onClick={() => toggleWarning(r.id)}
                            className="flex items-center gap-1 text-xs text-brand-warning hover:underline"
                          >
                            {expandedWarnings.has(r.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {r.warnings.length} 条异常
                          </button>
                          {expandedWarnings.has(r.id) && (
                            <div className="mt-1 space-y-1">
                              {r.warnings.map((w, i) => (
                                <div key={i} className="rounded bg-slate-900/50 px-2 py-1 text-xs">
                                  <div className="text-brand-danger">[{w.type}] {w.message}</div>
                                  {w.affectedTradeIds.length > 0 && (
                                    <div className="text-brand-text-secondary">影响交易：{w.affectedTradeIds.join(", ")}</div>
                                  )}
                                  {w.affectedCollateralIds.length > 0 && (
                                    <div className="text-brand-text-secondary">影响质押券：{w.affectedCollateralIds.join(", ")}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-brand-text-secondary">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {results.length === 0 && (
        <div className="py-20 text-center text-brand-text-secondary">
          尚未执行处理，点击上方按钮开始
        </div>
      )}
    </div>
  );
}
