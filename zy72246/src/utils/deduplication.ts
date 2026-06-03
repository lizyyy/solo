import { TaxNote, ImportRowData, ImportResult, ImportDetail, ProcessingStatus, ProcessStep } from '@/types';
import { generateBusinessKey, determineInitialStatus, detectFieldChanges, checkReversalRule } from './boundaryRules';
import { createVersionRecord, createStatusHistoryRecord, generateUUID } from './versionControl';

export function checkDuplicate(existingRecords: TaxNote[], rowData: ImportRowData): TaxNote | null {
  const businessKey = generateBusinessKey(rowData.tradeDate, rowData.stockCode, rowData.serialNumber);
  return existingRecords.find(record => record.id === businessKey) || null;
}

export interface ProcessImportResult {
  taxNotes: TaxNote[];
  versions: ReturnType<typeof createVersionRecord>[];
  statusHistories: ReturnType<typeof createStatusHistoryRecord>[];
  importResult: ImportResult;
}

export function processImportData(
  existingRecords: TaxNote[],
  importRows: ImportRowData[],
  currentUser: string
): ProcessImportResult {
  const result: ProcessImportResult = {
    taxNotes: [],
    versions: [],
    statusHistories: [],
    importResult: {
      totalRecords: importRows.length,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      reversalPendingRecords: 0,
      details: [],
    },
  };

  for (const row of importRows) {
    try {
      const existingRecord = checkDuplicate(existingRecords, row);
      const isReversalPending = checkReversalRule(row.amount, row.remark);

      if (!existingRecord) {
        const newRecord = createNewTaxNote(row, currentUser);
        result.taxNotes.push(newRecord);
        result.importResult.newRecords++;

        const statusHistory = createStatusHistoryRecord(
          newRecord.id,
          null,
          newRecord.processingStatus,
          currentUser,
          '初始导入'
        );
        result.statusHistories.push(statusHistory);

        result.importResult.details.push({
          lineNumber: row.lineNumber,
          action: 'NEW',
          reason: '新记录导入',
          recordId: newRecord.id,
        });

        if (isReversalPending) {
          result.importResult.reversalPendingRecords++;
        }
      } else {
        const updates: Partial<TaxNote> = {
          currentRemark: row.remark,
          currentAmount: row.amount,
          counterTailNumber: row.counterTailNumber,
        };

        const changes = detectFieldChanges(existingRecord, updates);

        if (changes.length === 0) {
          result.importResult.skippedRecords++;
          result.importResult.details.push({
            lineNumber: row.lineNumber,
            action: 'SKIP',
            reason: '无字段变更，跳过',
            recordId: existingRecord.id,
          });
        } else {
          const updatedRecord: TaxNote = {
            ...existingRecord,
            ...updates,
            version: existingRecord.version + 1,
            updatedBy: currentUser,
            updatedAt: new Date().toISOString(),
          };

          if (isReversalPending && updatedRecord.processingStatus !== ProcessingStatus.REVERSAL_PENDING_REVIEW) {
            updatedRecord.processingStatus = ProcessingStatus.REVERSAL_PENDING_REVIEW;
            const statusHistory = createStatusHistoryRecord(
              updatedRecord.id,
              existingRecord.processingStatus,
              updatedRecord.processingStatus,
              currentUser,
              '重新导入检测到冲正标记'
            );
            result.statusHistories.push(statusHistory);
            result.importResult.reversalPendingRecords++;
          }

          result.taxNotes.push(updatedRecord);
          result.importResult.updatedRecords++;

          for (const change of changes) {
            const version = createVersionRecord(
              updatedRecord.id,
              updatedRecord.version,
              change.field,
              change.oldValue,
              change.newValue,
              currentUser,
              '重新导入更新'
            );
            result.versions.push(version);
          }

          result.importResult.details.push({
            lineNumber: row.lineNumber,
            action: 'UPDATE',
            reason: `检测到${changes.length}个字段变更`,
            recordId: existingRecord.id,
          });
        }
      }
    } catch (error) {
      result.importResult.errorRecords++;
      result.importResult.details.push({
        lineNumber: row.lineNumber,
        action: 'ERROR',
        reason: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  return result;
}

function createNewTaxNote(rowData: ImportRowData, currentUser: string): TaxNote {
  const businessKey = generateBusinessKey(rowData.tradeDate, rowData.stockCode, rowData.serialNumber);
  const now = new Date().toISOString();
  const initialStatus = determineInitialStatus(rowData);

  return {
    id: businessKey,
    originalLineNumber: rowData.lineNumber,
    tradeDate: rowData.tradeDate,
    stockCode: rowData.stockCode,
    stockName: rowData.stockName,
    serialNumber: rowData.serialNumber,
    originalAmount: rowData.amount,
    currentAmount: rowData.amount,
    originalRemark: rowData.remark,
    currentRemark: rowData.remark,
    counterTailNumber: rowData.counterTailNumber,
    summary: '',
    processingStatus: initialStatus,
    currentStep: ProcessStep.STEP_1_IMPORT,
    version: 1,
    createdBy: currentUser,
    createdAt: now,
    updatedBy: currentUser,
    updatedAt: now,
  };
}

export { generateUUID };
