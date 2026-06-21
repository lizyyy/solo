import { Gauge, PlayCircle, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import ParamVersionCard from "@/components/params/ParamVersionCard";
import AnomalyTimeline from "@/components/review/AnomalyTimeline";

export default function CenterPanel() {
  const { submitBatch, drafts, activeParamVersionId, loading, error } = useAppStore();
  const canRun = drafts.length > 0 && !!activeParamVersionId && !loading;

  const handleSubmit = async () => {
    if (!canRun) return;
    await submitBatch();
  };

  return (
    <section
      className="flex-1 min-w-0 h-full flex flex-col gap-4 p-4 animate-fade-in-up"
      style={{ animationDelay: "120ms" }}
    >
      <div className="flex items-center gap-3">
        <div className="card card-hover flex-1 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-ink-50 text-ink-600 flex items-center justify-center shrink-0">
            <Gauge size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="section-title !text-base">批量验算启动</h2>
            <p className="text-xs text-ink-400 mt-0.5">
              自动识别答案版本冲突、重复提交、重复样本与不齐整材料
            </p>
            {error && (
              <p className="text-xs text-ochre-600 mt-1 font-medium">{error}</p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canRun}
            className={`btn-primary !px-6 ${
              !canRun ? "opacity-50 cursor-not-allowed" : "hover:animate-glow"
            }`}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <PlayCircle size={16} />
            )}
            {loading ? "验算中…" : "启动验算"}
          </button>
        </div>
        <ParamVersionCard />
      </div>

      <div className="card flex-1 min-h-0 flex flex-col p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title !text-base">复核视图</h3>
            <p className="text-xs text-ink-400 mt-0.5">
              参数版本 · 异常点 · 解释说明 同页展示
            </p>
          </div>
          <div className="text-xs text-ink-400 font-mono">
            异常来源与影响范围并排
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin pr-1">
          <AnomalyTimeline />
        </div>
      </div>
    </section>
  );
}
