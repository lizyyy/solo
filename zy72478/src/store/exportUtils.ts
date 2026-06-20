import * as XLSX from "xlsx";
import type { ExportResult } from "../../shared/types";

export function buildExportFile(rows: any[], fileName: string, sheetName: string): ExportResult {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const preview = rows.slice(0, 3).map((r) => Object.values(r).join(" | ")).join("\n");
  return {
    success: true,
    fileName: fileName + "_" + new Date().toISOString().slice(0, 10) + ".csv",
    rowCount: rows.length,
    contentPreview: preview,
    downloadUrl: url,
  };
}
