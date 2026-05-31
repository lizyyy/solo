import type { ConflictItem, FilterState } from "@/types";
import { formatConflictType, formatConflictStatus } from "@/utils/humanMessage";

export function exportConflictsCSV(
  conflicts: ConflictItem[],
  filters: FilterState
): void {
  const filtered = applyFilters(conflicts, filters);

  const headers = [
    "冲突类型",
    "状态",
    "站址",
    "时间",
    "人话提示",
    "关联计划",
    "关联版本",
  ];

  const rows = filtered.map((c) => [
    formatConflictType(c.type),
    formatConflictStatus(c.status),
    c.stationName,
    c.description,
    c.humanMessage,
    c.payloadPlanId,
    c.payloadPlanVersion,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCSVField).join(","))
    .join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8",
  });

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `冲突导出_${timestamp}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function applyFilters(
  conflicts: ConflictItem[],
  filters: FilterState
): ConflictItem[] {
  return conflicts.filter((c) => {
    if (
      filters.conflictTypes.length > 0 &&
      !filters.conflictTypes.includes(c.type)
    ) {
      return false;
    }

    if (
      filters.statuses.length > 0 &&
      !filters.statuses.includes(c.status)
    ) {
      return false;
    }

    if (
      filters.stationName &&
      !c.stationName.includes(filters.stationName)
    ) {
      return false;
    }

    if (filters.timeRangeStart) {
      const start = new Date(filters.timeRangeStart).getTime();
      const detected = new Date(c.detectedAt).getTime();
      if (detected < start) return false;
    }

    if (filters.timeRangeEnd) {
      const end = new Date(filters.timeRangeEnd).getTime();
      const detected = new Date(c.detectedAt).getTime();
      if (detected > end) return false;
    }

    return true;
  });
}

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
