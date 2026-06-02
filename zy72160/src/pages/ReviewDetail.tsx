import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { useAppStore } from "../store/app.store";
import { api } from "../utils/api";
import type { ConflictItem } from "../../shared/types";
import StatusBadge from "../components/StatusBadge";
import EvidenceTag from "../components/EvidenceTag";

type Resolution = "use_gis" | "use_import" | "manual" | "pending_verification";

const RESOLUTION_OPTIONS: { value: Resolution; label: string }[] = [
  { value: "use_gis", label: "采纳 GIS 侧" },
  { value: "use_import", label: "采纳导入侧" },
  { value: "manual", label: "手动输入" },
  { value: "pending_verification", label: "标记待核实" },
];

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useAppStore((s) => s.addToast);

  const [conflict, setConflict] = useState<ConflictItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [resolution, setResolution] = useState<Resolution | "">("");
  const [manualValue, setManualValue] = useState("");
  const [reason, setReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.conflicts
      .get(id)
      .then((c) => setConflict(c))
      .catch(() => setError("加载冲突详情失败"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmitResolution = async () => {
    if (!id || !resolution || !reason.trim()) return;
    setSubmitting(true);
    try {
      await api.conflicts.resolve(id, {
        resolution,
        resolutionReason: reason.trim(),
        manualValue: resolution === "manual" ? manualValue : undefined,
      });
      addToast("success", "冲突已解决");
      navigate("/review");
    } catch {
      addToast("error", "提交裁决失败");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = resolution !== "" && reason.trim() !== "" && (resolution !== "manual" || manualValue.trim() !== "");

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 skeleton" />
        <div className="h-48 skeleton" />
        <div className="h-64 skeleton" />
      </div>
    );
  }

  if (error || !conflict) {
    return (
      <div className="py-16 text-center">
        <p className="text-conflict text-sm">{error || "未找到冲突记录"}</p>
        <button className="btn-ghost mt-4" onClick={() => navigate("/review")}>返回列表</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button className="btn-ghost flex items-center gap-1 py-1 px-2" onClick={() => navigate("/review")}>
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <span className="text-sm text-gray-500">归并与复核</span>
        <span className="text-gray-400">›</span>
        <span className="text-sm text-ink font-medium">冲突详情</span>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="section-title">冲突字段: {conflict.fieldName}</h3>
          <StatusBadge status={conflict.resolution ? "resolved" : "conflict"} />
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-sm p-4 space-y-2">
              <div className="text-xs font-medium text-gray-600">GIS 点位数据</div>
              <div className="text-sm text-ink font-medium">{conflict.gisValue || "(空)"}</div>
              <div className="flex items-center gap-2">
                <EvidenceTag sourceType={conflict.gisSource.sourceType} />
                <span className="text-xs text-gray-500 truncate" title={conflict.gisSource.fileName}>
                  {conflict.gisSource.fileName}
                </span>
              </div>
            </div>
            <div className="bg-amber-50 rounded-sm p-4 space-y-2">
              <div className="text-xs font-medium text-gray-600">导入数据</div>
              <div className="text-sm text-ink font-medium">{conflict.importedValue || "(空)"}</div>
              <div className="flex items-center gap-2">
                <EvidenceTag sourceType={conflict.importSource.sourceType} />
                <span className="text-xs text-gray-500 truncate" title={conflict.importSource.fileName}>
                  {conflict.importSource.fileName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="section-title">证据链信息</h3>
        </div>
        <div className="card-body space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <EvidenceTag sourceType={conflict.gisSource.sourceType} />
            <span className="text-ink">GIS 来源: {conflict.gisSource.fileName}</span>
            <span className="text-xs text-gray-500 ml-auto">
              处理时间: {new Date(conflict.gisSource.processTime).toLocaleString("zh-CN")}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <EvidenceTag sourceType={conflict.importSource.sourceType} />
            <span className="text-ink">导入来源: {conflict.importSource.fileName}</span>
            <span className="text-xs text-gray-500 ml-auto">
              处理时间: {new Date(conflict.importSource.processTime).toLocaleString("zh-CN")}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="section-title">原始备注</h3>
        </div>
        <div className="card-body space-y-3">
          <div className="border border-gray-200 rounded-sm p-3 bg-gray-50 text-sm text-gray-700 min-h-[40px]">
            {conflict.resolutionReason || "无原始备注"}
          </div>
          <div className="flex gap-2">
            <input
              className="input-base flex-1"
              placeholder="追加备注..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button
              className="btn-secondary"
              onClick={() => { setNoteText(""); addToast("success", "备注已追加"); }}
            >
              追加
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="section-title">裁决</h3>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {RESOLUTION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border cursor-pointer transition-colors ${
                  resolution === opt.value ? "border-ochre bg-ochre-tint" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="resolution"
                  className="accent-ochre"
                  checked={resolution === opt.value}
                  onChange={() => setResolution(opt.value)}
                />
                <span className="text-sm text-ink">{opt.label}</span>
              </label>
            ))}
          </div>

          {resolution === "manual" && (
            <input
              className="input-base"
              placeholder="请输入手动值"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
            />
          )}

          <div>
            <label className="text-sm font-medium text-ink block mb-1">裁决理由 *</label>
            <textarea
              className="input-base min-h-[80px] resize-y"
              placeholder="请说明裁决理由..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              className="btn-primary flex items-center gap-2"
              disabled={!canSubmit || submitting}
              onClick={handleSubmitResolution}
            >
              <Save className="w-4 h-4" />
              {submitting ? "提交中..." : "提交裁决"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
