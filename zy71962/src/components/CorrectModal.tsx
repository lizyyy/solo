import { useState } from "react";
import { X, Save } from "lucide-react";
import { useStore } from "@/store";
import type { FeatureSpec } from "../../shared/types";

export default function CorrectModal({
  feature,
  onClose,
}: {
  feature: FeatureSpec | null;
  onClose: () => void;
}) {
  const { correctFeature } = useStore();
  const [trainingSpec, setTrainingSpec] = useState(feature?.trainingSpec || "");
  const [onlineSpec, setOnlineSpec] = useState(feature?.onlineSpec || "");
  const [reason, setReason] = useState("");
  const [operator, setOperator] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!feature) return null;

  async function handleSubmit() {
    setError("");
    if (!reason.trim()) {
      setError("请输入修正原因");
      return;
    }
    if (!operator.trim()) {
      setError("请输入操作人");
      return;
    }

    setSubmitting(true);
    try {
      await correctFeature(feature.id, {
        trainingSpec,
        onlineSpec,
        operator: operator.trim(),
        reason: reason.trim(),
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "修正失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="font-mono-display text-lg font-semibold text-zinc-100">
            修正特征: {feature.featureName}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              当前训练口径
            </label>
            <div className="p-2 bg-zinc-900 rounded text-xs font-mono-display text-zinc-500 border border-zinc-700">
              {feature.trainingSpec}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              新训练口径
            </label>
            <input
              type="text"
              value={trainingSpec}
              onChange={(e) => setTrainingSpec(e.target.value)}
              className="input-dark w-full text-sm font-mono-display"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              当前线上口径
            </label>
            <div className="p-2 bg-zinc-900 rounded text-xs font-mono-display text-zinc-500 border border-zinc-700">
              {feature.onlineSpec}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              新线上口径
            </label>
            <input
              type="text"
              value={onlineSpec}
              onChange={(e) => setOnlineSpec(e.target.value)}
              className="input-dark w-full text-sm font-mono-display"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              修正原因 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入修正原因"
              className="input-dark w-full text-sm resize-none h-20"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              操作人 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="输入操作人姓名"
              className="input-dark w-full text-sm"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-700">
          <button onClick={onClose} className="btn-ghost text-sm">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {submitting ? "提交中..." : "提交修正"}
          </button>
        </div>
      </div>
    </div>
  );
}
