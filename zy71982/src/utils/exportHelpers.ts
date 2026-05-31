import type {
  CompensationEvent,
  StatusChange,
  AuditLog,
  ExportFormat,
  FilterState,
  DiffItem,
} from "@/types";

export function exportToCsv(
  events: CompensationEvent[],
  statusChanges: StatusChange[],
  auditLogs: AuditLog[],
  includeStatusHistory: boolean,
  includeAuditLogs: boolean
): string {
  const statusLabel = (s: string) => {
    const m: Record<string, string> = {
      pending: "待处理",
      processing: "处理中",
      success: "已成功",
      failed: "已失败",
      pending_confirm_idempotency: "待确认-幂等键失效",
      pending_confirm_audit_gap: "待确认-审计日志缺口",
      pending_confirm_param_corrupted: "待确认-参数破坏",
      revoked: "已撤回",
    };
    return m[s] || s;
  };

  const headers = [
    "事件ID",
    "幂等键",
    "状态",
    "异常类型",
    "接入方",
    "Webhook地址",
    "创建时间",
    "最后更新时间",
    "版本",
  ];
  const rows = events.map((e) => [
    e.id,
    e.idempotencyKey,
    statusLabel(e.status),
    e.exceptionType === "none" ? "" : e.exceptionType,
    e.clientId,
    e.webhookUrl,
    new Date(e.createdAt).toISOString(),
    new Date(e.updatedAt).toISOString(),
    e.version,
  ]);

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCsv).join(","));
  for (const row of rows) {
    csvLines.push(row.map(escapeCsv).join(","));
  }

  if (includeStatusHistory) {
    csvLines.push("");
    csvLines.push("=== 状态变更记录 ===");
    csvLines.push(
      ["事件ID", "变更前", "变更后", "原因", "操作人", "时间"]
        .map(escapeCsv)
        .join(",")
    );
    const eventIds = new Set(events.map((e) => e.id));
    for (const sc of statusChanges) {
      if (eventIds.has(sc.eventId)) {
        csvLines.push(
          [
            sc.eventId,
            statusLabel(sc.fromStatus),
            statusLabel(sc.toStatus),
            sc.reason,
            sc.operator,
            new Date(sc.timestamp).toISOString(),
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
    }
  }

  if (includeAuditLogs) {
    csvLines.push("");
    csvLines.push("=== 审计日志 ===");
    csvLines.push(
      ["事件ID", "操作", "详情", "操作人", "时间"]
        .map(escapeCsv)
        .join(",")
    );
    const eventIds = new Set(events.map((e) => e.id));
    for (const log of auditLogs) {
      if (eventIds.has(log.eventId)) {
        csvLines.push(
          [
            log.eventId,
            log.action,
            log.detail,
            log.operator,
            new Date(log.timestamp).toISOString(),
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
    }
  }

  return "\uFEFF" + csvLines.join("\n");
}

export function exportToJson(
  events: CompensationEvent[],
  statusChanges: StatusChange[],
  auditLogs: AuditLog[],
  includeStatusHistory: boolean,
  includeAuditLogs: boolean
): string {
  const result: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    totalEvents: events.length,
    events,
  };

  if (includeStatusHistory) {
    const eventIds = new Set(events.map((e) => e.id));
    result.statusChanges = statusChanges.filter((sc) =>
      eventIds.has(sc.eventId)
    );
  }

  if (includeAuditLogs) {
    const eventIds = new Set(events.map((e) => e.id));
    result.auditLogs = auditLogs.filter((log) => eventIds.has(log.eventId));
  }

  return JSON.stringify(result, null, 2);
}

export function generateExport(
  format: ExportFormat,
  events: CompensationEvent[],
  statusChanges: StatusChange[],
  auditLogs: AuditLog[],
  includeStatusHistory: boolean,
  includeAuditLogs: boolean
): string {
  if (format === "csv") {
    return exportToCsv(
      events,
      statusChanges,
      auditLogs,
      includeStatusHistory,
      includeAuditLogs
    );
  }
  return exportToJson(
    events,
    statusChanges,
    auditLogs,
    includeStatusHistory,
    includeAuditLogs
  );
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function checkExportConsistency(
  filteredEvents: CompensationEvent[],
  currentFilter: FilterState,
  allEvents: CompensationEvent[]
): { consistent: boolean; issues: string[] } {
  const issues: string[] = [];

  const reFiltered = allEvents.filter((e) => applyFilter(e, currentFilter));
  if (reFiltered.length !== filteredEvents.length) {
    issues.push(
      `筛选结果数量不一致：当前 ${filteredEvents.length} 条，重新筛选 ${reFiltered.length} 条。可能由于数据在操作期间发生了变更。`
    );
  }

  const filteredIds = new Set(filteredEvents.map((e) => e.id));
  const reFilteredIds = new Set(reFiltered.map((e) => e.id));
  const missingIds = [...filteredIds].filter((id) => !reFilteredIds.has(id));
  const extraIds = [...reFilteredIds].filter((id) => !filteredIds.has(id));

  if (missingIds.length > 0) {
    issues.push(
      `${missingIds.length} 条事件在重新筛选后消失，可能状态已变更：${missingIds.slice(0, 3).join(", ")}${missingIds.length > 3 ? " ..." : ""}`
    );
  }

  if (extraIds.length > 0) {
    issues.push(
      `${extraIds.length} 条新事件满足当前筛选条件，但未在导出范围中：${extraIds.slice(0, 3).join(", ")}${extraIds.length > 3 ? " ..." : ""}`
    );
  }

  const pendingCount = filteredEvents.filter((e) =>
    e.status.startsWith("pending_confirm")
  ).length;
  if (pendingCount > 0) {
    issues.push(
      `导出数据中包含 ${pendingCount} 条待确认事件，这些事件的结果尚未最终确定。`
    );
  }

  return { consistent: issues.length === 0, issues };
}

function applyFilter(
  event: CompensationEvent,
  filter: FilterState
): boolean {
  if (
    filter.statuses.length > 0 &&
    !filter.statuses.includes(event.status)
  ) {
    return false;
  }
  if (
    filter.exceptionTypes.length > 0 &&
    !filter.exceptionTypes.includes(event.exceptionType)
  ) {
    return false;
  }
  if (filter.clientId && event.clientId !== filter.clientId) {
    return false;
  }
  if (
    filter.idempotencyKeySearch &&
    !event.idempotencyKey
      .toLowerCase()
      .includes(filter.idempotencyKeySearch.toLowerCase())
  ) {
    return false;
  }
  if (filter.timeRangeStart && event.createdAt < filter.timeRangeStart) {
    return false;
  }
  if (filter.timeRangeEnd && event.createdAt > filter.timeRangeEnd) {
    return false;
  }
  return true;
}

export function computeImportDiff(
  importedEvents: CompensationEvent[],
  existingEvents: CompensationEvent[]
): DiffItem[] {
  const existingMap = new Map(
    existingEvents.map((e) => [e.idempotencyKey, e])
  );
  const importedMap = new Map(
    importedEvents.map((e) => [e.idempotencyKey, e])
  );
  const diffs: DiffItem[] = [];

  for (const [key, evt] of importedMap) {
    if (!existingMap.has(key)) {
      diffs.push({ idempotencyKey: key, type: "added", newValue: evt.payload });
    } else {
      const existing = existingMap.get(key)!;
      if (existing.payload !== evt.payload || existing.status !== evt.status) {
        const changes: string[] = [];
        if (existing.payload !== evt.payload) changes.push("payload");
        if (existing.status !== evt.status) changes.push("status");
        diffs.push({
          idempotencyKey: key,
          type: "modified",
          oldValue: existing.payload,
          newValue: evt.payload,
          field: changes.join(", "),
        });
      }
    }
  }

  for (const [key, evt] of existingMap) {
    if (!importedMap.has(key)) {
      diffs.push({
        idempotencyKey: key,
        type: "removed",
        oldValue: evt.payload,
      });
    }
  }

  return diffs;
}
