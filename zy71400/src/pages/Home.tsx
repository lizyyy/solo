import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  draft: "bg-slate-600 text-slate-100",
  processed: "bg-blue-600/30 text-blue-400",
  reviewed: "bg-emerald-600/30 text-emerald-400",
  exported: "bg-amber-600/30 text-amber-400",
};

const statusLabels: Record<string, string> = {
  draft: "草稿",
  processed: "已处理",
  reviewed: "已复核",
  exported: "已导出",
};

export default function Home() {
  const { batches, fetchBatches, createBatch, setCurrentBatchId } = useStore();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createBatch({ name: name.trim(), date });
    setName("");
    setDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
  };

  const handleSelectBatch = (id: string) => {
    setCurrentBatchId(id);
    navigate("/entry");
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-text-primary">批次管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-md bg-brand-warning px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-400"
        >
          <Plus size={16} />
          新建批次
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-brand-card p-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-brand-text-secondary">批次名称</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-brand-text-secondary">日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning"
              />
            </div>
            <button
              onClick={handleCreate}
              className="rounded-md bg-brand-success px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-400"
            >
              创建
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-slate-600 px-4 py-1.5 text-sm text-brand-text-secondary hover:text-brand-text-primary"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="py-20 text-center text-brand-text-secondary">
          暂无批次，请点击上方按钮创建
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <div
              key={batch.id}
              onClick={() => handleSelectBatch(batch.id)}
              className="cursor-pointer rounded-lg border border-slate-700 bg-brand-card p-4 transition-colors hover:border-slate-500"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-text-primary">{batch.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusStyles[batch.status] || statusStyles.draft
                  )}
                >
                  {statusLabels[batch.status] || batch.status}
                </span>
              </div>
              <div className="space-y-1 text-xs text-brand-text-secondary">
                <div className="flex justify-between">
                  <span>日期</span>
                  <span className="font-mono-data">{batch.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>创建时间</span>
                  <span className="font-mono-data">{new Date(batch.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
