#!/usr/bin/env python3
content = r"""import { TaxNote, ImportRowData, ImportResult, ImportDetail, ProcessingStatus, ProcessStep, DuplicateAction, DuplicateResolution } from '@/types';
import { generateBusinessKey, determineInitialStatus, detectFieldChanges, checkReversalRule } from './boundaryRules';
import { createVersionRecord, createStatusHistoryRecord, generateUUID } from './versionControl';

export function checkDuplicate(existingRecords: TaxNote[], rowData: ImportRowData): TaxNote | null {
  const businessKey = generateBusinessKey(rowData.tradeDate, rowData.stockCode, rowData.serialNumber);
  return existingRecords.find(record => record.id === businessKey) || null;
}

export function analyzeDuplicates(
  existingRecords: TaxNote[],
  importRows: ImportRowData[]
): {
  newRecords: ImportRowData[];
  potentialDuplicates: { row: ImportRowData; existing: TaxNote; rowIndex: number }[];
  errors: string[];
} {
  const newRecords: ImportRowData[] = [];
  const potentialDuplicates: { row: ImportRowData; existing: TaxNote; rowIndex: number }[] = [];
  const errors: string[] = [];

  importRows.forEach((row, index) => {
    try {
      const existing = checkDuplicate(existingRecords, row);
      if (existing) {
        potentialDuplicates.push({ row, existing, rowIndex: index });
      } else {
        newRecords.push(row);
      }
    } catch (error) {
      errors.push('row ' + row.lineNumber + ': ' + (error instanceof Error ? error.message : 'analysis error'));
    }
  });

  return { newRecords, potentialDuplicates, errors };
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
  currentUser: string,
  duplicateResolutions?: DuplicateResolution[]
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
      duplicateRecords: 0,
      details: [],
    },
  };

  const resolutionMap = new Map<string, DuplicateResolution>();
  if (duplicateResolutions) {
    duplicateResolutions.forEach(res => {
      resolutionMap.set(res.rowIndex + '_' + res.recordId, res);
    });
  }

  for (let rowIndex = 0; rowIndex < importRows.length; rowIndex++) {
    const row = importRows[rowIndex];
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
          'initial import'
        );
        result.statusHistories.push(statusHistory);

        result.importResult.details.push({
          lineNumber: row.lineNumber,
          action: 'NEW',
          reason: 'new record import',
          recordId: newRecord.id,
        });

        if (isReversalPending) {
          result.importResult.reversalPendingRecords++;
        }
      } else {
        const resolutionKey = rowIndex + '_' + existingRecord.id;
        const resolution = resolutionMap.get(resolutionKey);

        if (!resolution) {
          result.importResult.duplicateRecords++;
          result.importResult.details.push({
            lineNumber: row.lineNumber,
            action: 'DUPLICATE',
            reason: 'duplicate detected, awaiting user action',
            recordId: existingRecord.id,
            existingRecord,
            newRowData: row,
          });
          continue;
        }

        switch (resolution.action) {
          case DuplicateAction.SKIP:
            result.importResult.skippedRecords++;
            result.importResult.details.push({
              lineNumber: row.lineNumber,
              action: 'SKIP',
              reason: 'user chose to skip duplicate',
              recordId: existingRecord.id,
            });
            break;

          case DuplicateAction.CONFIRM_UPDATE: {
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
                reason: 'no field changes, skip',
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
                  're-import detected reversal mark'
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
                  're-import update'
                );
                result.versions.push(version);
              }

              result.importResult.details.push({
                lineNumber: row.lineNumber,
                action: 'UPDATE',
                reason: 'user confirmed update, ' + changes.length + ' field changes detected',
                recordId: existingRecord.id,
              });
            }
            break;
          }

          case DuplicateAction.MERGE: {
            const mergedRemark = resolution.mergeRemark
              ? existingRecord.currentRemark + ' | ' + resolution.mergeRemark + ' | ' + row.remark
              : existingRecord.currentRemark + ' | ' + row.remark;

            const updates: Partial<TaxNote> = {
              currentRemark: mergedRemark,
              currentAmount: row.amount !== 0 ? row.amount : existingRecord.currentAmount,
              counterTailNumber: row.counterTailNumber || existingRecord.counterTailNumber,
            };

            const changes = detectFieldChanges(existingRecord, updates);

            if (changes.length === 0) {
              result.importResult.skippedRecords++;
              result.importResult.details.push({
                lineNumber: row.lineNumber,
                action: 'SKIP',
                reason: 'no changes after merge, skip',
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
                  'merge remark' + (resolution.mergeRemark ? ': ' + resolution.mergeRemark : '')
                );
                result.versions.push(version);
              }

              result.importResult.details.push({
                lineNumber: row.lineNumber,
                action: 'UPDATE',
                reason: 'user chose merge, ' + changes.length + ' field changes detected',
                recordId: existingRecord.id,
              });
            }
            break;
          }
        }
      }
    } catch (error) {
      result.importResult.errorRecords++;
      result.importResult.details.push({
        lineNumber: row.lineNumber,
        action: 'ERROR',
        reason: error instanceof Error ? error.message : 'unknown error',
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
"""

with open('/Users/lzy/pro/solo/workspaces/zy72246/src/utils/deduplication.ts', 'w') as f:
    f.write(content)

import os
size = os.path.getsize('/Users/lzy/pro/solo/workspaces/zy72246/src/utils/deduplication.ts')
print(f'File written successfully. Size: {size} bytes')
