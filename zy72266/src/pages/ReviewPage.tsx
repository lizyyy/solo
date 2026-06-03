import { useState } from "react";
import { useGateStore } from "@/store/useGateStore";
import { ClipboardCheck, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { RULE_LABELS } from "@/types";
import type { SafetyRadiusRecord } from "@/types";

export default function ReviewPage() {
  const records = useGateStore((s) => s.records);
  const getDetectionsForRecord = useGateStore((s) => s.getDetectionsForRecord);
  const transitionRecord = useGateStore((s) => s.transitionRecord);
  const currentUser = useGateStore((s) => s.currentUser);

  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [reviewDetail, setReviewDetail] = useState("");

  const pendingRecords = records.filter((r) => r.status === "pending_review");
  const otherRecords = records.filter((r) => r.status !== "pending_review");

  const sortedRecords = [
    ...pendingRecords.sort((a, b) => {
      const detA = getDetectionsForRecord(a.id);
      const detB = getDetectionsForRecord(b.id);
      const isAnomalyA = detA?.ruleCode === "ZR-001" || detA?.ruleCode === "ZR-003";
      const isAnomalyB = detB?.ruleCode === "ZR-001" || detB?.ruleCode === "ZR-003";
      if (isAnomalyA && !isAnomalyB) return -1;
      if (!isAnomalyA && isAnomalyB) return 1;
      return 0;
    }),
    ...otherRecords,
  ];

  const handleReview = (recordId: string, action: "review_confirm_normal" | "review_confirm_anomaly") => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    const detection = getDetectionsForRecord(recordId);
    let detail = "";

    if (action === "review_confirm_normal") {
      detail = `教官确认第${record.originalRowNumber}行记录正常`;
    } else {
      detail = `教官确认第${record.originalRowNumber}行异常`;
      if (detection?.ruleCode === "ZR-001") {
        detail += "，Z轴方向按旧习惯写反，标记待现场复核";
      }
    }

    const success = transitionRecord(recordId, action, detail);

    if (success && action === "review_confirm_anomaly") {
      const det = getDetectionsForRecord(recordId);
      if (det?.ruleCode === "ZR-001") {
        transitionRecord(recordId, "mark_pending_field_review", `第${record.originalRowNumber}行Z轴方向按旧习惯写反，自动标记待现场复核`);
      }
    }

    setSelectedRecord(null);
    setReviewDetail("");
  };

  const selected = selectedRecord
    ? records.find((r) => r.id === selectedRecord)
    : null;
  const selectedDetection = selectedRecord
    ? getDetectionsForRecord(selectedRecord)
    : null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          坐标原点说明审核
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          培训教官逐条审核坐标原点说明，Z轴方向按旧习惯写反的记录标记"待现场复核"，不自动归正常
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <span className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
          待审核: {pendingRecords.length}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}>
          已处理: {otherRecords.length}
        </span>
      </div>

      {sortedRecords.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <ClipboardCheck size={48} style={{ color: "var(--color-text-muted)" }} className="mx-auto mb-4" />
          <p className="text-base font-medium" style={{ color: "var(--color-text)" }}>
            暂无记录可审核
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            请先在安全半径表导入页上传数据
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRecords.map((record) => {
            const detection = getDetectionsForRecord(record.id);
            const isAnomaly = detection?.ruleCode === "ZR-001" || detection?.ruleCode === "ZR-003";
            const isSelected = selectedRecord === record.id;
            const isPending = record.status === "pending_review";

            return (
              <div key={record.id}
                className="rounded-xl border transition-all"
                style={{
                  backgroundColor: isSelected ? "var(--color-surface-hover)" : "var(--color-surface)",
                  borderColor: isSelected ? "var(--color-steel)" : "var(--color-border)",
                }}>
                <div className="flex items-stretch">
                  {isAnomaly && (
                    <div className="w-1 rounded-l-xl flex-shrink-0"
                      style={{ backgroundColor: detection?.ruleCode === "ZR-001" ? "#EF4444" : "#F59E0B" }} />
                  )}

                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                          第 {record.originalRowNumber} 行
                        </span>
                        <StatusBadge status={record.status} />
                        {isAnomaly && detection && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: detection.ruleCode === "ZR-001" ? "#FEE2E2" : "#FEF3C7",
                              color: detection.ruleCode === "ZR-001" ? "#991B1B" : "#92400E",
                            }}>
                            <AlertTriangle size={10} />
                            {RULE_LABELS[detection.ruleCode]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>闸门开度</span>
                        <p className="font-medium" style={{ color: "var(--color-text)" }}>
                          {record.gateOpening}m
                        </p>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>安全半径</span>
                        <p className="font-medium" style={{ color: "var(--color-text)" }}>
                          {record.safetyRadius}m
                        </p>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>Z轴值</span>
                        <p className="font-medium"
                          style={{ color: record.zAxisValue !== null && record.zAxisValue < 0 ? "#EF4444" : "var(--color-text)" }}>
                          {record.zAxisValue ?? "缺失"}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>坐标原点</span>
                        <p className="font-medium" style={{ color: "var(--color-text)" }}>
                          {record.coordinateOrigin}
                        </p>
                      </div>
                    </div>

                    {detection && isAnomaly && (
                      <div className="mt-2 p-2 rounded-lg text-xs"
                        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text-muted)" }}>
                        <strong style={{ color: "var(--color-warning)" }}>检测建议:</strong>{" "}
                        {detection.suggestedAction}
                      </div>
                    )}

                    {isPending && (
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={() => handleReview(record.id, "review_confirm_normal")}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                          style={{ backgroundColor: "var(--color-success)", color: "#fff" }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
                          <CheckCircle size={14} />
                          确认正常
                        </button>
                        <button
                          onClick={() => handleReview(record.id, "review_confirm_anomaly")}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                          style={{ backgroundColor: "var(--color-warning)", color: "#fff" }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
                          <AlertTriangle size={14} />
                          确认异常
                        </button>
                        {detection?.ruleCode === "ZR-001" && (
                          <span className="text-xs flex items-center gap-1"
                            style={{ color: "var(--color-text-muted)" }}>
                            <ArrowRight size={12} />
                            确认异常后将自动标记为"待现场复核"
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
