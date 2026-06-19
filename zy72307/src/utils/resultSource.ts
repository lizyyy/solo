import { WeightTableData, UnifiedResult, WeightRow, ChangeHistoryEntry } from '../types';

let globalDataVersion = 1;

export function setGlobalDataVersion(version: number): void {
  globalDataVersion = version;
}

export function buildUnifiedResult(
  tableData: WeightTableData
): UnifiedResult {
  const rows = tableData.rows;
  const totalRows = rows.length;
  const warningCount = rows.filter(r => r.status === 'warning').length;
  const errorCount = rows.filter(r => r.status === 'error').length;
  const needsReviewCount = rows.filter(r => r.status === 'needs_review').length;
  const normalCount = rows.filter(r => r.status === 'normal').length;
  const modifiedCount = rows.filter(r => r.isManualModified).length;
  const duplicateImportCount = rows.filter(r => r.isDuplicateImport).length;

  return {
    rows: rows.map(r => ({ ...r })),
    matrixResult: tableData.matrixResult ? { ...tableData.matrixResult } : null,
    summary: {
      totalRows,
      warningCount,
      errorCount,
      needsReviewCount,
      normalCount,
      modifiedCount,
      duplicateImportCount
    },
    processStep: tableData.processStep,
    importTime: tableData.importTime,
    importedBy: tableData.importedBy,
    history: [...tableData.history],
    dataVersion: tableData.dataVersion,
    importBatches: [...tableData.importBatches],
    currentBatchId: tableData.currentBatchId,
    exportTime: new Date()
  };
}

export function getResultForDisplay(unifiedResult: UnifiedResult) {
  return unifiedResult.rows;
}

export function getResultForExport(unifiedResult: UnifiedResult) {
  return unifiedResult.rows;
}

export function getResultForAPI(unifiedResult: UnifiedResult) {
  return unifiedResult;
}

export function createHistoryEntry(params: {
  row: WeightRow;
  field: ChangeHistoryEntry['field'];
  oldValue: string;
  newValue: string;
  changedBy: string;
  reason?: string;
}): ChangeHistoryEntry {
  return {
    id: Math.random().toString(36).substring(2, 15),
    rowId: params.row.id,
    criterionName: params.row.criterionName,
    field: params.field,
    oldValue: params.oldValue,
    newValue: params.newValue,
    changedBy: params.changedBy,
    changedAt: new Date(),
    reason: params.reason,
    dataVersion: globalDataVersion
  };
}
