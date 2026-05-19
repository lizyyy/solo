import * as fs from 'fs';
import * as path from 'path';
import { db } from '../models/database';
import { QualityRecord, UserContext, BadRecord, ImportHistory } from '../models/types';
import { validateLabValue, validateBatchId, validateOrderId, validatePaperBatch, validateDate, validateUser, ValidationError } from '../utils/validation';

interface OrderJsonData {
  batchId: string;
  orderId: string;
  labValues: { L: number | string; a: number | string; b: number | string };
  paperBatch: string;
  operator: string;
  role: string;
  measuredAt: string;
}

export interface JsonImportResult {
  importHistory: ImportHistory;
  successRecords: QualityRecord[];
  badRecords: BadRecord[];
}

function buildBadRecord(
  importHistoryId: string,
  index: number,
  rawData: string,
  errors: ValidationError[],
  fileName: string
): Omit<BadRecord, 'id' | 'createdAt' | 'isResolved'> {
  const failureReason = errors.map(e => `${e.field}: ${e.message}`).join('; ');
  const suggestions = errors.map(e => e.suggestion);

  return {
    importHistoryId,
    originalPosition: `${fileName} 第 ${index + 1} 条`,
    rawData,
    failureReason,
    suggestions,
  };
}

export async function importOrderJson(
  filePath: string,
  userContext: UserContext
): Promise<JsonImportResult> {
  const fileName = path.basename(filePath);

  let importHistory = db.importHistories.create({
    importType: 'json',
    fileName,
    operator: userContext.operator,
    role: userContext.role,
    totalCount: 0,
    successCount: 0,
    failedCount: 0,
    status: 'processing',
  });

  const content = fs.readFileSync(filePath, 'utf8');
  let dataArray: OrderJsonData[];

  try {
    const parsed = JSON.parse(content);
    dataArray = Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    db.importHistories.update(importHistory.id, {
      status: 'failed',
      completedAt: new Date(),
    });

    db.badRecords.create({
      importHistoryId: importHistory.id,
      originalPosition: fileName,
      rawData: content.substring(0, 500),
      failureReason: `JSON解析错误: ${(error as Error).message}`,
      suggestions: ['请检查JSON格式是否正确，确保使用双引号、逗号分隔等正确格式'],
    });

    return { importHistory, successRecords: [], badRecords: db.badRecords.findByImportHistoryId(importHistory.id) };
  }

  db.importHistories.update(importHistory.id, { totalCount: dataArray.length });

  const successRecords: QualityRecord[] = [];
  const badRecordsToCreate: Array<Omit<BadRecord, 'id' | 'createdAt' | 'isResolved'>> = [];

  for (let i = 0; i < dataArray.length; i++) {
    const row = dataArray[i];
    const errors: ValidationError[] = [];
    const rawData = JSON.stringify(row);

    const batchIdResult = validateBatchId(row.batchId);
    if (!batchIdResult.isValid) errors.push(...batchIdResult.errors);

    const orderIdResult = validateOrderId(row.orderId);
    if (!orderIdResult.isValid) errors.push(...orderIdResult.errors);

    const labResult = validateLabValue({
      L: row.labValues?.L,
      a: row.labValues?.a,
      b: row.labValues?.b,
    });
    if (!labResult.isValid) errors.push(...labResult.errors);

    const paperBatchResult = validatePaperBatch(row.paperBatch);
    if (!paperBatchResult.isValid) errors.push(...paperBatchResult.errors);

    const dateResult = validateDate(row.measuredAt);
    if (!dateResult.isValid) errors.push(...dateResult.errors);

    const userResult = validateUser(row.operator, row.role);
    if (!userResult.isValid) errors.push(...userResult.errors);

    if (errors.length > 0) {
      badRecordsToCreate.push(
        buildBadRecord(importHistory.id, i, rawData, errors, fileName)
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
          details: { batchId: record.batchId, source: 'json_import' },
        });
      }
    }
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
