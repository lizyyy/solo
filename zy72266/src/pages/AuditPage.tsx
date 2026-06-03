import { useState } from "react";
import { useGateStore } from "@/store/useGateStore";
import { History, Filter, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { STATUS_LABELS, ACTION_LABELS } from "@/types";
import type { RecordStatus } from "@/types";

const STATUS_FILTERS: { value: RecordStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "pending_review", label: "待复核" },
  { value: "confirmed_normal", label: "已确认正常" },
  { value: "confirmed_anomaly", label: "已确认异常" },
  { value: "pending_field_review", label: "待现场复核" },
  { value: "corrected", label: "已更正" },
  { value: "rolled_back", label: "已回滚" },
];

export default function AuditPage() {
  const records = useGateStore((s) => s.records);
  const auditLogs = useGateStore((s) => s.auditLogs);
  const getAuditLogsForRecord = useGateStore((s) => s.getAuditLogsForRecord);
  const getDetectionsForRecord = useGateStore((s) => s.getDetectionsForRecord);
  const rollbackRecord = useGateStore((s) => s.rollbackRecord);

  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all");
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [rollbackModalId, setRollbackModalId] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");

  const filteredRecords =
    statusFilter === "all"
      ? records
      : records.filter((r) => r.status === statusFilter);

  const handleRollback = (recordId: string) => {
    if (!rollbackReason.trim()) return;
    rollbackRecord(recordId, rollbackReason.trim());
    setRollbackModalId(null);
    setRollbackReason("");
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          审计追踪
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          查看每条记录的原始行号、人工改动、当前处理状态，支持回滚操作
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Filter size={16} style={{ color: "var(--color-text-muted)" }} />
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>状态筛选:</span>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all border"
              style={{
                backgroundColor: statusFilter === filter.value ? "var(--color-steel)" : "transparent",
                borderColor: statusFilter === filter.value ? "var(--color-steel)" : "var(--color-border)",
                color: statusFilter === filter.value ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <History size={48} style={{ color: "var(--color-text-muted)" }} className="mx-auto mb-4" />
          <p className="text-base font-medium" style={{ color: "var(--color-text)" }}>
            暂无审计记录
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            {statusFilter !== "all" ? "当前筛选条件下无记录" : "请先导入安全半径表"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const logs = getAuditLogsForRecord(record.id);
            const detection = getDetectionsForRecord(record.id);
            const isExpanded = expandedRecord === record.id;
            const canRollback = record.status === "corrected" || record.status === "confirmed_normal";

            return (
              <div key={record.id}
                className="rounded-xl border"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <button
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                      第 {record.originalRowNumber} 行
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      闸门开度: {record.gateOpening}m | 安全半径: {record.safetyRadius}m
                    </span>
                    {detection && (detection.ruleCode === "ZR-001" || detection.ruleCode === "ZR-003") && (
                      <span className="px-2 py-0.5 rounded-full text-xs"
                        style={{
                          backgroundColor: detection.ruleCode === "ZR-001" ? "#FEE2E2" : "#FEF3C7",
                          color: detection.ruleCode === "ZR-001" ? "#991B1B" : "#92400E",
                        }}>
                        {detection.ruleCode === "ZR-001" ? "Z轴写反" : "Z轴缺失"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {logs.length} 条操作
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor:
                          record.status === "pending_review" ? "#FEF3C7" :
                          record.status === "confirmed_normal" ? "#D1FAE5" :
                          record.status === "confirmed_anomaly" ? "#FEE2E2" :
                          record.status === "pending_field_review" ? "#FFEDD5" :
                          record.status === "corrected" ? "#DBEAFE" : "#E5E7EB",
                        color:
                          record.status === "pending_review" ? "#92400E" :
                          record.status === "confirmed_normal" ? "#065F46" :
                          record.status === "confirmed_anomaly" ? "#991B1B" :
                          record.status === "pending_field_review" ? "#9A3412" :
                          record.status === "corrected" ? "#1E40AF" : "#374151",
                      }}>
                      {STATUS_LABELS[record.status]}
                    </span>
                    {canRollback && (
                      <RotateCcw size={14} style={{ color: "var(--color-text-muted)" }}
                        onClick={(e) => { e.stopPropagation(); setRollbackModalId(record.id); }} />
                    )}
                    {isExpanded ? (
                      <ChevronUp size={16} style={{ color: "var(--color-text-muted)" }} />
                    ) : (
                      <ChevronDown size={16} style={{ color: "var(--color-text-muted)" }} />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4"
                    style={{ borderColor: "var(--color-border)" }}>
                    <div className="grid grid-cols-5 gap-4 py-3 text-xs border-b"
                      style={{ borderColor: "var(--color-border)" }}>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>原始行号</span>
                        <p className="font-bold mt-0.5" style={{ color: "var(--color-text)" }}>
                          {record.originalRowNumber}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>Z轴值</span>
                        <p className="font-bold mt-0.5"
                          style={{
                            color: record.zAxisValue !== null && record.zAxisValue < 0
                              ? "#EF4444" : "var(--color-text)",
                          }}>
                          {record.zAxisValue ?? "缺失"}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>坐标原点</span>
                        <p className="font-bold mt-0.5" style={{ color: "var(--color-text)" }}>
                          {record.coordinateOrigin}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>当前状态</span>
                        <p className="font-bold mt-0.5" style={{ color: "var(--color-text)" }}>
                          {STATUS_LABELS[record.status]}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-text-muted)" }}>更新时间</span>
                        <p className="font-bold mt-0.5" style={{ color: "var(--color-text)" }}>
                          {new Date(record.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {detection && (
                      <div className="mt-3 p-2 rounded-lg text-xs"
                        style={{ backgroundColor: "var(--color-bg)" }}>
                        <span className="font-bold" style={{ color: "var(--color-warning)" }}>
                          Z轴检测:
                        </span>
                        {" "}{detection.detectionResult}
                        {" | "}
                        <span style={{ color: "var(--color-text-muted)" }}>
                          {detection.suggestedAction}
                        </span>
                      </div>
                    )}

                    <div className="mt-3">
                      <p className="text-xs font-bold mb-2" style={{ color: "var(--color-text)" }}>
                        变更日志
                      </p>
                      {logs.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          暂无变更记录
                        </p>
                      ) : (
                        <div className="space-y-0">
                          {logs.map((log, idx) => (
                            <div key={log.id} className="flex gap-3 pb-3">
                              <div className="flex flex-col items-center">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor:
                                      log.action === "rollback" ? "#6B7280" :
                                      log.action.includes("anomaly") ? "#EF4444" :
                                      log.action.includes("normal") || log.action.includes("correct") ? "#10B981" :
                                      "var(--color-steel)",
                                  }} />
                                {idx < logs.length - 1 && (
                                  <div className="w-px flex-1 mt-1"
                                    style={{ backgroundColor: "var(--color-border)" }} />
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold" style={{ color: "var(--color-text)" }}>
                                  {ACTION_LABELS[log.action]}
                                </p>
                                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                  {STATUS_LABELS[log.previousStatus]} → {STATUS_LABELS[log.newStatus]}
                                </p>
                                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                  {log.detail}
                                </p>
                                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                  {log.operator} ({log.operatorRole === "instructor" ? "教官" : "班组"}) · {new Date(log.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rollbackModalId && (
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
                onClick={() => { setRollbackModalId(null); setRollbackReason(""); }}
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                取消
              </button>
              <button
                onClick={() => handleRollback(rollbackModalId)}
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
