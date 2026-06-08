import { useState } from "react";
import { useGateStore } from "@/store/useGateStore";
import { BarChart3, Download, AlertTriangle, CheckCircle, Clock, RotateCcw } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { RULE_LABELS, ACTION_LABELS, STATUS_LABELS } from "@/types";
import type { RecordStatus, AuditLog } from "@/types";

export default function DisplayPage() {
  const records = useGateStore((s) => s.records);
  const auditLogs = useGateStore((s) => s.auditLogs);
  const getAuditLogsForRecord = useGateStore((s) => s.getAuditLogsForRecord);
  const getDetectionsForRecord = useGateStore((s) => s.getDetectionsForRecord);
  const transitionRecord = useGateStore((s) => s.transitionRecord);
  const manualCorrectZAxis = useGateStore((s) => s.manualCorrectZAxis);

  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [rollbackReason, setRollbackReason] = useState("");
  const [showRollbackModal, setShowRollbackModal] = useState<string | null>(null);

  const handleFieldAction = (
    recordId: string,
    action: "field_confirm_correct" | "field_confirm_no_change"
  ) => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    if (action === "field_confirm_correct") {
      const success = manualCorrectZAxis(recordId);
      if (!success) {
        transitionRecord(recordId, action, `现场班组确认第${record.originalRowNumber}行需更正Z轴方向`);
      }
    } else {
      const detail = `现场班组确认第${record.originalRowNumber}行无需更正`;
      transitionRecord(recordId, action, detail);
    }
  };

  const handleRollback = (recordId: string) => {
    if (!rollbackReason.trim()) return;
    transitionRecord(recordId, "rollback", rollbackReason.trim());
    setShowRollbackModal(null);
    setRollbackReason("");
  };

  const handleExport = () => {
    const headers = ["原始行号", "闸门开度", "安全半径", "Z轴值", "坐标原点", "Z轴方向", "状态", "创建时间", "更新时间"];
    const rows = records.map((r) => [
      r.originalRowNumber,
      r.gateOpening,
      r.safetyRadius,
      r.zAxisValue ?? "缺失",
      r.coordinateOrigin,
      r.zAxisDirection === "negative" ? "反向(旧习惯)" : r.zAxisDirection === "positive" ? "正向" : "缺失",
      STATUS_LABELS[r.status],
      r.createdAt,
      r.updatedAt,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `闸门开度数据_${new Date().toLocaleDateString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedLogs: AuditLog[] = selectedRecord
    ? getAuditLogsForRecord(selectedRecord)
    : [];

  const selectedDetection = selectedRecord
    ? getDetectionsForRecord(selectedRecord)
    : null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            闸门开度展示
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            汇总展示闸门开度数据，异常记录醒目标注，导出明细与页面展示口径一致
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{ backgroundColor: "var(--color-steel)", color: "#fff" }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
          <Download size={16} />
          导出明细
        </button>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <BarChart3 size={48} style={{ color: "var(--color-text-muted)" }} className="mx-auto mb-4" />
          <p className="text-base font-medium" style={{ color: "var(--color-text)" }}>
            暂无开度数据
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            请先导入安全半径表
          </p>
        </div>
      ) : (
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "var(--color-bg)" }}>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>原始行号</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>闸门开度</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>安全半径</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>Z轴值</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>坐标原点</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>状态</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: "var(--color-text-muted)" }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const detection = getDetectionsForRecord(record.id);
                      const isAnomaly = detection?.ruleCode === "ZR-001" || detection?.ruleCode === "ZR-003";
                      const isSelected = selectedRecord === record.id;

                      return (
                        <tr
                          key={record.id}
                          className="border-t cursor-pointer transition-colors"
                          style={{
                            borderColor: "var(--color-border)",
                            borderLeft: isAnomaly ? "3px solid #E8751A" : undefined,
                            backgroundColor: isSelected ? "var(--color-surface-hover)" : "transparent",
                          }}
                          onClick={() => {
                            setSelectedRecord(record.id);
                            setShowTimeline(true);
                          }}
                        >
                          <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>
                            {record.originalRowNumber}
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>
                            {record.gateOpening}m
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>
                            {record.safetyRadius}m
                          </td>
                          <td className="px-4 py-3">
                            <span style={{
                              color: record.zAxisValue !== null && record.zAxisValue < 0
                                ? "#EF4444" : "var(--color-text)",
                            }}>
                              {record.zAxisValue ?? "缺失"}
                            </span>
                            {isAnomaly && (
                              <AlertTriangle size={12} className="inline ml-1" style={{ color: "#E8751A" }} />
                            )}
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--color-text)" }}>
                            {record.coordinateOrigin}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={record.status} />
                          </td>
                          <td className="px-4 py-3">
                            {record.status === "pending_field_review" && (
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleFieldAction(record.id, "field_confirm_correct")}
                                  className="px-2 py-1 rounded text-xs font-bold transition-all"
                                  style={{ backgroundColor: "var(--color-success)", color: "#fff" }}>
                                  确认更正
                                </button>
                                <button
                                  onClick={() => handleFieldAction(record.id, "field_confirm_no_change")}
                                  className="px-2 py-1 rounded text-xs font-bold transition-all"
                                  style={{ backgroundColor: "var(--color-steel)", color: "#fff" }}>
                                  无需更正
                                </button>
                              </div>
                            )}
                            {(record.status === "corrected" || record.status === "confirmed_normal") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRollbackModal(record.id);
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
                                style={{ color: "var(--color-text-muted)" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-danger)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}>
                                <RotateCcw size={12} />
                                回滚
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {showTimeline && selectedRecord && (
            <div className="w-80 rounded-xl border p-4"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
              <h3 className="text-sm font-bold mb-4" style={{ color: "var(--color-text)" }}>
                路径回放
              </h3>

              {selectedDetection && (
                <div className="mb-4 p-3 rounded-lg text-xs"
                  style={{ backgroundColor: "var(--color-bg)" }}>
                  <p className="font-bold mb-1" style={{ color: "var(--color-warning)" }}>
                    Z轴检测结果
                  </p>
                  <p style={{ color: "var(--color-text-muted)" }}>
                    {RULE_LABELS[selectedDetection.ruleCode]}
                  </p>
                  <p className="mt-1" style={{ color: "var(--color-text-muted)" }}>
                    {selectedDetection.suggestedAction}
                  </p>
                  {selectedDetection.autoCorrectSuppressed && (
                    <p className="mt-1 font-bold" style={{ color: "#EF4444" }}>
                      ⚠ 自动修正已抑制，需现场班组确认
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-0">
                {selectedLogs.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    暂无变更记录
                  </p>
                ) : (
                  selectedLogs.map((log, idx) => (
                    <div key={log.id} className="flex gap-3 pb-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              log.action === "rollback"
                                ? "#6B7280"
                                : log.action.includes("anomaly") || log.action.includes("confirm_anomaly")
                                ? "#EF4444"
                                : log.action.includes("normal") || log.action.includes("correct")
                                ? "#10B981"
                                : "var(--color-steel)",
                          }} />
                        {idx < selectedLogs.length - 1 && (
                          <div className="w-px flex-1 mt-1"
                            style={{ backgroundColor: "var(--color-border)" }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
                          {ACTION_LABELS[log.action]}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {STATUS_LABELS[log.previousStatus]} → {STATUS_LABELS[log.newStatus]}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                          {log.detail}
                        </p>
                        {log.action === "manual_correction" && (
                          <p className="text-xs mt-0.5 font-bold" style={{ color: "var(--color-success)" }}>
                            ✓ Z轴值已人工更正
                          </p>
                        )}
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                          {log.operator} · {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showRollbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(15, 26, 46, 0.8)" }}>
          <div className="w-96 rounded-xl p-6 border"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <h3 className="text-base font-bold mb-2" style={{ color: "var(--color-text)" }}>
              回滚操作
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
              请输入回滚原因，回滚后记录将恢复至上一状态
            </p>
            <textarea
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              placeholder="请输入回滚原因..."
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none h-24"
              style={{
                backgroundColor: "var(--color-bg)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-steel)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => { setShowRollbackModal(null); setRollbackReason(""); }}
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                取消
              </button>
              <button
                onClick={() => handleRollback(showRollbackModal)}
                disabled={!rollbackReason.trim()}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{
                  backgroundColor: rollbackReason.trim() ? "var(--color-danger)" : "var(--color-border)",
                  color: "#fff",
                  cursor: rollbackReason.trim() ? "pointer" : "not-allowed",
                }}>
                确认回滚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
