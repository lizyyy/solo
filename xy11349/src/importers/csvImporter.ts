import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { db } from '../models/database';
import { QualityRecord, UserContext, BadRecord, ImportHistory } from '../models/types';
import { validateLabValue, validateBatchId, validateOrderId, validatePaperBatch, validateDate, validateUser, ValidationError } from '../utils/validation';

interface ColorCsvRow {
  batchId: string;
  orderId: string;
  L: string;
  a: string;
  b: string;
  paperBatch: string;
  operator: string;
  role: string;
  measuredAt: string;
}

export interface CsvImportResult {
  importHistory: ImportHistory;
  successRecords: QualityRecord[];
  badRecords: BadRecord[];
}

function buildBadRecord(
  importHistoryId: string,
  rowIndex: number,
  rawData: string,
  errors: ValidationError[],
  fileName: string
): Omit<BadRecord, 'id' | 'createdAt' | 'isResolved'> {
  const failureReason = errors.map(e => `${e.field}: ${e.message}`).join('; ');
  const suggestions = errors.map(e => e.suggestion);

  return {
    importHistoryId,
    originalPosition: `${fileName} 第 ${rowIndex + 1} 行`,
    rawData,
    failureReason,
    suggestions,
  };
}

export async function importColorCsv(
  filePath: string,
  userContext: UserContext
): Promise<CsvImportResult> {
  const fileName = path.basename(filePath);

  let importHistory = db.importHistories.create({
    importType: 'csv',
    fileName,
    operator: userContext.operator,
    role: userContext.role,
    totalCount: 0,
    successCount: 0,
    failedCount: 0,
    status: 'processing',
  });

  const results: ColorCsvRow[] = [];
  const successRecords: QualityRecord[] = [];
  const badRecordsToCreate: Array<Omit<BadRecord, 'id' | 'createdAt' | 'isResolved'>> = [];
  let rowIndex = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: ColorCsvRow) => {
        results.push(data);
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (error: Error) => {
        reject(error);
      });
  });

  db.importHistories.update(importHistory.id, { totalCount: results.length });

  for (const row of results) {
    const errors: ValidationError[] = [];
    const rawData = JSON.stringify(row);

    const batchIdResult = validateBatchId(row.batchId);
    if (!batchIdResult.isValid) errors.push(...batchIdResult.errors);

    const orderIdResult = validateOrderId(row.orderId);
    if (!orderIdResult.isValid) errors.push(...orderIdResult.errors);

    const labResult = validateLabValue({ L: row.L, a: row.a, b: row.b });
    if (!labResult.isValid) errors.push(...labResult.errors);

    const paperBatchResult = validatePaperBatch(row.paperBatch);
    if (!paperBatchResult.isValid) errors.push(...paperBatchResult.errors);

    const dateResult = validateDate(row.measuredAt);
    if (!dateResult.isValid) errors.push(...dateResult.errors);

    const userResult = validateUser(row.operator, row.role);
    if (!userResult.isValid) errors.push(...userResult.errors);

    if (errors.length > 0) {
      badRecordsToCreate.push(
        buildBadRecord(importHistory.id, rowIndex, rawData, errors, fileName)
      );
    } else {
      const existing = db.qualityRecords.findByBatchId(batchIdResult.data!);
      if (!existing) {
        const record = db.qualityRecords.create({
          batchId: batchIdResult.data!,
          orderId: orderIdResult.data!,
          labValues: labResult.data!,
          paperBatch: paperBatchResult.data!,
          operator: userResult.data!.operator,
          role: userResult.data!.role,
          measuredAt: dateResult.data!,
        });
        successRecords.push(record);

        db.auditLogs.create({
          action: 'CREATE',
          entityType: 'QualityRecord',
          entityId: record.id,
          operator: userContext.operator,
          role: userContext.role,
          details: { batchId: record.batchId, source: 'csv_import' },
        });
      }
    }
    rowIndex++;
  }

  const badRecords = db.badRecords.bulkCreate(badRecordsToCreate);

  importHistory = db.importHistories.update(importHistory.id, {
    successCount: successRecords.length,
    failedCount: badRecords.length,
    status: 'completed',
    completedAt: new Date(),
  })!;

  db.auditLogs.create({
    action: 'IMPORT',
    entityType: 'QualityRecord',
    operator: userContext.operator,
    role: userContext.role,
    details: {
      importHistoryId: importHistory.id,
      fileName,
      successCount: successRecords.length,
      failedCount: badRecords.length,
    },
  });

  return { importHistory, successRecords, badRecords };
}
