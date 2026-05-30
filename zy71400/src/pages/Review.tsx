import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";

export default function Review() {
  const { currentBatchId, batches, results, reviews, fetchResults, fetchReviews, submitReview } = useStore();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [remark, setRemark] = useState("");

  const currentBatch = batches.find((b) => b.id === currentBatchId);

  useEffect(() => {
    if (currentBatchId) {
      fetchResults(currentBatchId);
      fetchReviews(currentBatchId);
    }
  }, [currentBatchId, fetchResults, fetchReviews]);

  if (!currentBatchId || !currentBatch) {
    return <div className="py-20 text-center text-brand-text-secondary">请先从首页选择一个批次</div>;
  }

  if (results.length === 0) {
    return <div className="py-20 text-center text-brand-text-secondary">暂无处理结果，请先执行折算处理</div>;
  }

  const reviewedCount = reviews.filter((r) => r.status === "已复核").length;
  const totalCount = results.length;
  const allReviewed = reviewedCount === totalCount && totalCount > 0;

  const handleSubmitReview = async (resultId: string) => {
    if (!currentBatchId || !reviewer.trim()) return;
    await submitReview(currentBatchId, resultId, { status: "已复核", reviewer: reviewer.trim(), remark: remark.trim() || undefined });
    setReviewingId(null);
    setReviewer("");
    setRemark("");
  };

  const getReviewForResult = (resultId: string) => reviews.find((r) => r.resultId === resultId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-text-primary">结果复核</h1>
        <p className="mt-1 text-sm text-brand-text-secondary">批次：{currentBatch.name}</p>
      </div>

      <div className="mb-6 rounded-lg border border-slate-700 bg-brand-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-brand-text-secondary">复核进度</span>
          <span className="font-mono-data text-brand-text-primary">
            {reviewedCount} / {totalCount}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-brand-success transition-all"
            style={{ width: totalCount > 0 ? `${(reviewedCount / totalCount) * 100}%` : "0%" }}
          />
        </div>
        {allReviewed && (
          <div className="mt-3 flex items-center gap-2 text-sm text-brand-success">
            <CheckCircle size={16} />
            所有结果已复核完成
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="data-table">
          <thead className="bg-slate-800">
            <tr>
              <th>债券代码</th>
              <th>结论</th>
              <th>异常原因</th>
              <th>复核状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const review = getReviewForResult(r.id);
              const isReviewing = reviewingId === r.id;

              return (
                <tr key={r.id} className={cn(review && review.status !== "已复核" && "bg-amber-900/10")}>
                  <td>{r.bondCode}</td>
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
                    {r.warnings.length > 0
                      ? r.warnings.map((w) => w.message).join("; ")
                      : "-"}
                  </td>
                  <td>
                    {review && review.status === "已复核" ? (
                      <div className="text-xs">
                        <span className="rounded-full bg-emerald-600/30 px-2 py-0.5 text-emerald-400">已复核</span>
                        <div className="mt-1 text-brand-text-secondary">
                          {review.reviewer} · {review.reviewedAt ? new Date(review.reviewedAt).toLocaleString() : ""}
                        </div>
                      </div>
                    ) : (
                      <span className="rounded-full bg-slate-600 px-2 py-0.5 text-xs text-slate-100">待复核</span>
                    )}
                  </td>
                  <td>
                    {(!review || review.status !== "已复核") && !isReviewing && (
                      <button
                        onClick={() => setReviewingId(r.id)}
                        className="rounded-md bg-brand-info px-2 py-1 text-xs text-white hover:bg-blue-400"
                      >
                        确认
                      </button>
                    )}
                    {isReviewing && (
                      <div className="flex items-center gap-2">
                        <input
                          value={reviewer}
                          onChange={(e) => setReviewer(e.target.value)}
                          placeholder="复核人"
                          className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs text-brand-text-primary outline-none focus:border-brand-warning"
                        />
                        <input
                          value={remark}
                          onChange={(e) => setRemark(e.target.value)}
                          placeholder="备注(选填)"
                          className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs text-brand-text-primary outline-none focus:border-brand-warning"
                        />
                        <button
                          onClick={() => handleSubmitReview(r.id)}
                          className="rounded bg-brand-success px-2 py-0.5 text-xs text-white hover:bg-emerald-400"
                        >
                          提交
                        </button>
                        <button
                          onClick={() => { setReviewingId(null); setReviewer(""); setRemark(""); }}
                          className="rounded border border-slate-600 px-2 py-0.5 text-xs text-brand-text-secondary hover:text-brand-text-primary"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
