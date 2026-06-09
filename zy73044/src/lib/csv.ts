import Papa from "papaparse";
import type { SpareRecord, ImportBatch } from "./types";

export interface ParsedRow {
  rawRow: string;
  values: Record<string, string>;
}

export function parseCsv(text: string): ParsedRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (result.errors && result.errors.length > 0) {
    console.warn("CSV解析警告:", result.errors);
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return (result.data as Record<string, string>[]).map((row, i) => ({
    values: row,
    rawRow: lines[i + 1] ?? JSON.stringify(row),
  }));
}

export function getCsvHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const result = Papa.parse<string[]>(firstLine, { header: false, skipEmptyLines: true });
  return ((result.data as string[][])[0] ?? []).map((h) => h.trim()).filter(Boolean);
}

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const EXPORT_HEADERS: { key: keyof SpareRecord | keyof ImportBatch | "_statusLabel"; label: string }[] = [
  { key: "partNo", label: "备件编号" },
  { key: "partDesc", label: "备件描述" },
  { key: "sampling", label: "采样值" },
  { key: "_statusLabel", label: "处理状态" },
  { key: "remark", label: "人工备注" },
  { key: "sourceFile", label: "来源文件" },
  { key: "sourceBatch", label: "导入批次" },
  { key: "rawRow", label: "原始CSV行" },
];

const STATUS_LABEL_EXPORT: Record<SpareRecord["status"], string> = {
  pending: "待确认",
  confirmed: "已确认",
  withdrawn: "已撤回",
};

export function exportCsv(records: SpareRecord[]): string {
  const headerLine = EXPORT_HEADERS.map((h) => escapeCsv(h.label)).join(",");
  const bodyLines = records.map((r) =>
    EXPORT_HEADERS.map((h) => {
      if (h.key === "_statusLabel") return escapeCsv(STATUS_LABEL_EXPORT[r.status]);
      return escapeCsv(r[h.key as keyof SpareRecord]);
    }).join(",")
  );
  return [headerLine, ...bodyLines].join("\r\n");
}

export function downloadCsv(content: string, filename: string): void {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
