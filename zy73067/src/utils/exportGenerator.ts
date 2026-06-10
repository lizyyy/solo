import type { AlertRecord, ExportRow } from "@/types";
import { validateConsistency } from "./consistencyChecker";

function statusToText(s: string): string {
  const map: Record<string, string> = {
    pending: "待复核",
    reviewing: "复核中",
    approved: "已通过",
    rejected: "已驳回",
  };
  return map[s] ?? s;
}

function fileConclusionToText(c?: string): string {
  const map: Record<string, string> = {
    pass: "文件通过",
    fail: "文件驳回",
    pending: "未确认",
  };
  return c ? map[c] ?? c : "(未上传)";
}

export function generateExportRows(records: AlertRecord[]): ExportRow[] {
  return records.map((r) => {
    const consistency = validateConsistency(r);
    return {
      unifiedDeviceId: r.unifiedDeviceId,
      originalIds: r.originalDeviceIds.join(" / "),
      source: r.source,
      status: r.status,
      statusText: statusToText(r.status),
      remark: r.remark || "(未填写)",
      fileConclusion: fileConclusionToText(r.conclusionFile?.conclusion),
      isTempAdjusted: r.isTempThresholdAdjusted,
      bladeAngle: r.bladeAngle,
      bladeThreshold: r.bladeAngleThreshold,
      vibration: r.vibrationLevel,
      vibrationThreshold: r.vibrationThreshold,
      isConsistent: consistency.isConsistent,
      verifiedAt: new Date().toISOString(),
    };
  });
}

export function toCSV(rows: ExportRow[]): string {
  const headers = [
    "统一设备编号",
    "原始编号",
    "来源",
    "状态",
    "备注",
    "文件结论",
    "临时阈值调整",
    "叶片角度",
    "角度阈值",
    "振动水平",
    "振动阈值",
    "一致性校验",
    "导出时间",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    const cells = [
      row.unifiedDeviceId,
      `"${row.originalIds.replace(/"/g, '""')}"`,
      `"${row.source}"`,
      row.statusText,
      `"${row.remark.replace(/"/g, '""')}"`,
      row.fileConclusion,
      row.isTempAdjusted ? "是" : "否",
      row.bladeAngle.toString(),
      row.bladeThreshold.toString(),
      row.vibration.toString(),
      row.vibrationThreshold.toString(),
      row.isConsistent ? "一致" : "不一致",
      new Date(row.verifiedAt).toLocaleString("zh-CN"),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export function toJSON(rows: ExportRow[]): string {
  return JSON.stringify(
    rows.map((r) => ({
      ...r,
      verifiedAtText: new Date(r.verifiedAt).toLocaleString("zh-CN"),
    })),
    null,
    2
  );
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mimeType + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV(records: AlertRecord[]) {
  const rows = generateExportRows(records);
  const csv = toCSV(rows);
  const ts = new Date().toISOString().slice(0, 10);
  downloadFile(csv, `风机叶片阈值预警_摘要_${ts}.csv`, "text/csv");
}

export function exportToJSON(records: AlertRecord[]) {
  const rows = generateExportRows(records);
  const json = toJSON(rows);
  const ts = new Date().toISOString().slice(0, 10);
  downloadFile(json, `风机叶片阈值预警_摘要_${ts}.json`, "application/json");
}
