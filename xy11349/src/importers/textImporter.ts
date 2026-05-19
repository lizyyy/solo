import * as fs from 'fs';
import * as path from 'path';
import { db } from '../models/database';
import { ReworkRecord, UserContext, BadRecord, ImportHistory } from '../models/types';
import { validateBatchId, validateUser, ValidationError } from '../utils/validation';

interface ReworkTextRecord {
  batchId: string;
  reason: string;
  solution: string;
  operator: string;
  role: string;
  reworkedAt: string;
}

export interface TextImportResult {
  importHistory: ImportHistory;
  successRecords: ReworkRecord[];
  badRecords: BadRecord[];
}

function parseTextFile(content: string): ReworkTextRecord[] {
  const lines = content.trim().split('\n');
  const records: ReworkTextRecord[] = [];
  let currentRecord: Partial<ReworkTextRecord> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === '' || trimmedLine.startsWith('---')) {
      if (Object.keys(currentRecord).length > 0) {
        records.push(currentRecord as ReworkTextRecord);
        currentRecord = {};
      }
      continue;
    }

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmedLine.substring(0, colonIndex).trim().toLowerCase();
      const value = trimmedLine.substring(colonIndex + 1).trim();

      switch (key) {
        case '批次号':
        case 'batchid':
          currentRecord.batchId = value;
          break;
        case '返工原因':
        case 'reason':
          currentRecord.reason = value;
          break;
        case '解决方案':
        case 'solution':
          currentRecord.solution = value;
          break;
        case '操作人':
        case 'operator':
          currentRecord.operator = value;
          break;
        case '角色':
        case 'role':
          currentRecord.role = value;
          break;
        case '返工时间':
        case 'reworkedat':
          currentRecord.reworkedAt = value;
          break;
      }
    }
  }

  if (Object.keys(currentRecord).length > 0) {
    records.push(currentRecord as ReworkTextRecord);
  }

  return records;
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
    originalPosition: `${fileName} 第 ${index + 1} 条记录`,
    rawData,
    failureReason,
    suggestions,
  };
}

function validateReworkDate(dateStr: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!dateStr || String(dateStr).trim() === '') {
    errors.push({
      field: 'reworkedAt',
      message: '返工时间不能为空',
      suggestion: '请输入返工时间，格式: YYYY-MM-DD HH:mm:ss',
    });
    return errors;
  }

  const date = new Date(String(dateStr));
  if (isNaN(date.getTime())) {
    errors.push({
      field: 'reworkedAt',
      message: `"${dateStr}" 不是有效的日期格式`,
      suggestion: '请使用正确的日期格式，例如: 2024-01-15 14:30:00',
    });
  }

  return errors;
}

function validateReasonSolution(reason: unknown, solution: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!reason || String(reason).trim() === '') {
    errors.push({
      field: 'reason',
      message: '返工原因不能为空',
      suggestion: '请输入返工原因',
    });
  }

  if (!solution || String(solution).trim() === '') {
    errors.push({
      field: 'solution',
      message: '解决方案不能为空',
      suggestion: '请输入解决方案',
    });
  }

  return errors;
}

export async function importReworkText(
  filePath: string,
  userContext: UserContext
): Promise<TextImportResult> {
  const fileName = path.basename(filePath);

  let importHistory = db.importHistories.create({
    importType: 'text',
    fileName,
    operator: userContext.operator,
    role: userContext.role,
    totalCount: 0,
    successCount: 0,
    failedCount: 0,
    status: 'processing',
  });

  const content = fs.readFileSync(filePath, 'utf8');
  const records = parseTextFile(content);

  db.importHistories.update(importHistory.id, { totalCount: records.length });

  const successRecords: ReworkRecord[] = [];
  const badRecordsToCreate: Array<Omit<BadRecord, 'id' | 'createdAt' | 'isResolved'>> = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const errors: ValidationError[] = [];
    const rawData = JSON.stringify(row);

    const batchIdResult = validateBatchId(row.batchId);
    if (!batchIdResult.isValid) errors.push(...batchIdResult.errors);

    errors.push(...validateReasonSolution(row.reason, row.solution));
    errors.push(...validateReworkDate(row.reworkedAt));

    const userResult = validateUser(row.operator, row.role);
    if (!userResult.isValid) errors.push(...userResult.errors);

    if (errors.length > 0) {
      badRecordsToCreate.push(
        buildBadRecord(importHistory.id, i, rawData, errors, fileName)
      );
    } else {
      const qualityRecord = db.qualityRecords.findByBatchId(batchIdResult.data!);
      const record = db.reworkRecords.create({
        qualityRecordId: qualityRecord?.id || '',
        batchId: batchIdResult.data!,
        reason: String(row.reason).trim(),
        solution: String(row.solution).trim(),
        operator: userResult.data!.operator,
        role: userResult.data!.role,
        reworkedAt: new Date(String(row.reworkedAt)),
      });
      successRecords.push(record);

      db.auditLogs.create({
        action: 'CREATE',
        entityType: 'ReworkRecord',
        entityId: record.id,
        operator: userContext.operator,
        role: userContext.role,
        details: { batchId: record.batchId, source: 'text_import' },
      });
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
    entityType: 'ReworkRecord',
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
