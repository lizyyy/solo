import type { DetectionRecord, AlgoResult } from "@/data/types";
import { MATERIAL_BATCHES } from "@/data/mockData";

const STATUS_LABEL: Record<DetectionRecord["status"], string> = {
  normal: "正常",
  anomalous: "异常",
  boundary: "边界/脏数据",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function csvEscape(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface BuildCsvInput {
  result: AlgoResult;
  thresholdMm: number;
  packName: string;
}

export function buildCsv({ result, thresholdMm, packName }: BuildCsvInput): string {
  const lines: string[] = [];
  const now = new Date();
  lines.push(
    `# 阈值: ${thresholdMm.toFixed(2)} mm | 试样包: ${packName} | 生成时间: ${fmtTime(now.toISOString())}`,
  );
  lines.push(
    [
      "样本ID",
      "检测时间",
      "时间窗口",
      "原始检测值(mm)",
      "偏差(mm)",
      "拉动贡献",
      "判定",
      "异常原因",
      "反掩盖拉动",
      "材料批次",
      "供应商",
      "入库日期",
      "材料类型",
      "同批异常数",
    ].map(csvEscape).join(","),
  );

  for (const r of result.records) {
    const mat = MATERIAL_BATCHES[r.batchId];
    lines.push(
      [
        r.id,
        fmtTime(r.detectTime),
        fmtTime(r.timeWindow),
        r.rawValue.toFixed(3),
        (r.deviation ?? 0).toFixed(3),
        `${((r.contribution ?? 0) * 100).toFixed(1)}%`,
        STATUS_LABEL[r.status],
        r.anomalyReason ?? "",
        r.isStrongPull ? "是" : "否",
        r.batchId,
        mat?.supplier ?? "",
        mat?.inboundDate ?? "",
        mat?.materialType ?? "",
        mat?.sameBatchAnomalies ?? 0,
      ].map(csvEscape).join(","),
    );
  }

  return lines.join("\n");
}

export function downloadCsv(csv: string, packId: string, thresholdMm: number) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  a.href = url;
  a.download = `桥梁支座异常归因_${packId}_阈值${thresholdMm.toFixed(2)}mm_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
