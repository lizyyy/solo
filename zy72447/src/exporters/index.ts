import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ReconciliationStore, defaultStore } from '../store';
import { buildDetailRow, detailRowToExportColumns, buildSummary, buildLogRow, FIELD_LABELS } from '../shared/presenter';

export function exportResultsToExcel(
  store: ReconciliationStore,
  outputPath: string
): string {
  const details = store.getResultsWithDetails();
  const rows = details.map(({ result, groupRecord, contractRecord }) => {
    const row = buildDetailRow(result, groupRecord, contractRecord);
    return detailRowToExportColumns(row);
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '核对明细');

  const summaryItems = buildSummary(details);
  const summaryRows = summaryItems.map((s) => ({
    统计项: s.label,
    数量: s.value,
    标识: s.key
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, '统计汇总');

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  XLSX.writeFile(wb, outputPath);
  return outputPath;
}

export function exportAuditLogToExcel(
  store: ReconciliationStore,
  outputPath: string
): string {
  const state = store.getState();
  const rows = state.logs.map((log) => {
    const row = buildLogRow(log);
    return {
      操作ID: row.id,
      操作类型: row.operationType,
      实体类型: row.entityType,
      实体ID: row.entityId,
      操作人: row.operator,
      时间: row.timestamp,
      批次ID: row.batchId,
      备注: row.notes,
      旧状态摘要: row.oldStateSummary,
      新状态摘要: row.newStateSummary
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '操作日志');

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  XLSX.writeFile(wb, outputPath);
  return outputPath;
}
