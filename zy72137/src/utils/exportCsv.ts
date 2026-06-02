import type { SampleRecord } from "@/types";

export function exportCsv(records: SampleRecord[], filename?: string): void {
  const headers = [
    "原始文件名",
    "曲目名",
    "来源路径",
    "授权状态",
    "授权到期日",
    "时码起点",
    "时码终点",
    "时长(秒)",
    "重复",
    "旧版母带",
    "人工改名",
    "时码错位",
    "用户备注",
    "导入批次",
    "创建时间",
    "更新时间",
  ];

  const rows = records.map((r) => [
    r.originalFileName,
    r.trackName,
    r.sourcePath,
    statusLabel(r.authorizationStatus),
    r.authorizationExpiry || "",
    r.timecodeStart || "",
    r.timecodeEnd || "",
    r.duration?.toString() || "",
    r.isDuplicate ? "是" : "否",
    r.isOldMaster ? "是" : "否",
    r.isManualRename ? "是" : "否",
    r.hasTimecodeIssue ? "是" : "否",
    r.userNote,
    r.originalImportBatch,
    r.createdAt,
    r.updatedAt,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => {
        const s = String(cell);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      })
        .join(",")
    )
    .join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `采样授权清单_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusLabel(s: SampleRecord["authorizationStatus"]): string {
  const map: Record<string, string> = {
    valid: "有效",
    expired: "已过期",
    missing: "缺授权",
    unknown: "未确认",
  };
  return map[s] || s;
}
