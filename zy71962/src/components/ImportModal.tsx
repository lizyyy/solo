import { useState } from "react";
import { X, Upload } from "lucide-react";
import { useStore } from "@/store";

export default function ImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { importFeatures } = useStore();
  const [jsonText, setJsonText] = useState("");
  const [operator, setOperator] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit() {
    setError("");
    let parsed: { featureName: string; trainingSpec: string; onlineSpec: string }[];
    try {
      parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error();
    } catch {
      setError("JSON 格式错误，请输入数组格式");
      return;
    }

    if (!operator.trim()) {
      setError("请输入操作人");
      return;
    }

    setSubmitting(true);
    try {
      await importFeatures(parsed, operator.trim());
      setJsonText("");
      setOperator("");
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="font-mono-display text-lg font-semibold text-zinc-100">
            导入特征
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
              JSON 数据
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='[{"featureName":"xxx","trainingSpec":"...","onlineSpec":"..."}]'
              className="input-dark w-full h-40 text-xs font-mono-display resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              操作人
            </label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="输入操作人姓名"
              className="input-dark w-full text-sm"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
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
            <Upload className="w-4 h-4" />
            {submitting ? "导入中..." : "导入"}
          </button>
        </div>
      </div>
    </div>
  );
}
