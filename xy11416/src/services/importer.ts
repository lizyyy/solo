import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { DatabaseManager } from '../database';
import { getParser, BaseParser } from '../parsers';
import { standardizeRow, validateStandardizedData } from './standardizer';
import {
  SourceType,
  ImportResult,
  FailedRecord,
  ImportMode,
} from '../types';

export interface ImportOptions {
  mode?: ImportMode;
  batchId?: string;
  operator?: string;
  sourceType?: SourceType;
}

export class ImportService {
  private db: DatabaseManager;
  private workDir: string;

  constructor(db: DatabaseManager, workDir: string) {
    this.db = db;
    this.workDir = workDir;
  }

  async importFile(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    const batchId = options.batchId || uuidv4().slice(0, 8);
    const operator = options.operator || 'system';
    const mode: ImportMode = options.mode || 'update';

    const absolutePath = path.resolve(filePath);
    const fileName = path.basename(absolutePath);

    const parser: BaseParser = getParser(absolutePath);
    const sourceType: SourceType = options.sourceType || this.detectSourceType(fileName);

    const rows = await parser.parse(absolutePath);

    const session = await this.db.createImportSession({
      batchId,
      sourceType,
      sourceFile: fileName,
      totalRecords: rows.length,
    });

    const failedRecords: FailedRecord[] = [];
    let successCount = 0;
    let failedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      for (const row of rows) {
        const result = await this.processRow(row, fileName, sourceType, batchId, mode, operator);
        if (result.success) {
          successCount++;
          if (result.updated) {
            updatedCount++;
          }
        } else if (result.skipped) {
          skippedCount++;
        } else {
          failedCount++;
          failedRecords.push({
            rawRecordId: result.rawRecordId,
            sourceFile: fileName,
            rawLineNumber: row.rawLineNumber,
            rawContent: row.rawContent,
            errors: result.errors,
          });
        }
      }

      await this.db.updateImportSession(batchId, rows.length, 'completed');
    } catch (error) {
      await this.db.updateImportSession(batchId, 0, 'failed');
      throw error;
    }

    return {
      batchId,
      totalRecords: rows.length,
      successCount,
      failedCount,
      updatedCount,
      skippedCount,
      failedRecords,
      importedAt: moment().toISOString(),
    };
  }

  private async processRow(
    row: any,
    fileName: string,
    sourceType: SourceType,
    batchId: string,
    mode: ImportMode,
    operator: string
  ): Promise<{ success: boolean; skipped: boolean; updated: boolean; errors: string[]; rawRecordId: string }> {
    const errors: string[] = [];
    let rawRecordId = '';
    let updated = false;

    const existing = await this.db.findRawRecordByFingerprint(fileName, row.rawLineNumber, batchId);
    if (existing && mode === 'skip') {
      return { success: false, skipped: true, updated: false, errors: [], rawRecordId: existing.id };
    }

    const rawRecord = await this.db.insertRawRecord({
      sourceFile: fileName,
      sourceType,
      rawLineNumber: row.rawLineNumber,
      rawContent: row.rawContent,
      importBatchId: batchId,
      status: 'pending',
    });
    rawRecordId = rawRecord.id;

    const stdResult = standardizeRow(row, sourceType);
    if (!stdResult.success || !stdResult.data) {
      errors.push(...stdResult.errors.map(e => e.message));
      await this.db.updateRawRecordStatus(rawRecord.id, 'failed');
      for (const err of stdResult.errors) {
        await this.db.insertValidationError({
          recordId: rawRecord.id,
          fieldName: err.field,
          errorCode: err.code,
          errorMessage: err.message,
          severity: 'error',
        });
      }
      return { success: false, skipped: false, updated: false, errors, rawRecordId };
    }

    const validationErrors = validateStandardizedData(stdResult.data, sourceType);
    if (validationErrors.length > 0) {
      errors.push(...validationErrors.map(e => e.message));
      for (const err of validationErrors) {
        await this.db.insertValidationError({
          recordId: rawRecord.id,
          fieldName: err.field,
          errorCode: err.code,
          errorMessage: err.message,
          severity: err.severity,
        });
      }
    }

    const orderNumber = stdResult.data.orderNumber;
    if (!orderNumber) {
      errors.push('缺少工单号，无法关联事实记录');
      await this.db.updateRawRecordStatus(rawRecord.id, 'failed');
      return { success: false, skipped: false, updated: false, errors, rawRecordId };
    }

    let factRecord = await this.db.findFactByOrderNumber(orderNumber);
    if (factRecord) {
      if (factRecord.isFrozen) {
        errors.push(`工单 ${orderNumber} 已冻结，无法修改`);
        await this.db.updateRawRecordStatus(rawRecord.id, 'failed');
        return { success: false, skipped: false, updated: false, errors, rawRecordId };
      }
      updated = true;
      await this.db.logChange(factRecord.id, 'import', 'existing', 'updated', operator, `从 ${fileName} 更新数据`);
      await this.db.updateFactRecord(factRecord.id, {
        currentStatus: this.determineStatus(sourceType, stdResult.data),
      });
    } else {
      factRecord = await this.db.createFactRecord(
        orderNumber,
        this.determineStatus(sourceType, stdResult.data)
      );
      await this.db.logChange(factRecord.id, 'import', 'new', 'created', operator, `从 ${fileName} 创建工单`);
    }

    await this.db.insertStandardizedRecord({
      rawRecordId: rawRecord.id,
      factId: factRecord.id,
      orderNumber: stdResult.data.orderNumber,
      residentName: stdResult.data.residentName,
      roomNumber: stdResult.data.roomNumber,
      phoneNumber: stdResult.data.phoneNumber,
      repairType: stdResult.data.repairType,
      description: stdResult.data.description,
      reportTime: stdResult.data.reportTime,
      technicianName: stdResult.data.technicianName,
      arrivalTime: stdResult.data.arrivalTime,
      completionTime: stdResult.data.completionTime,
      repairResult: stdResult.data.repairResult,
      materialName: stdResult.data.materialName,
      materialQuantity: stdResult.data.materialQuantity,
      materialUnit: stdResult.data.materialUnit,
      supervisorNote: stdResult.data.supervisorNote,
      standardizedAt: moment().toISOString(),
      standardizedBy: operator,
      isManualOverride: false,
      confidence: stdResult.confidence,
    });

    const hasErrors = validationErrors.some(e => e.severity === 'error');
    await this.db.updateRawRecordStatus(rawRecord.id, hasErrors ? 'failed' : 'imported');

    return {
      success: !hasErrors,
      skipped: false,
      updated,
      errors,
      rawRecordId,
    };
  }

  private detectSourceType(fileName: string): SourceType {
    const lower = fileName.toLowerCase();
    if (lower.includes('报修') || lower.includes('report') || lower.includes('resident')) {
      return 'resident_report';
    }
    if (lower.includes('回执') || lower.includes('receipt') || lower.includes('technician')) {
      return 'technician_receipt';
    }
    if (lower.includes('材料') || lower.includes('material') || lower.includes('usage')) {
      return 'material_usage';
    }
    if (lower.includes('批注') || lower.includes('note') || lower.includes('supervisor')) {
      return 'supervisor_note';
    }
    return 'resident_report';
  }

  private determineStatus(sourceType: SourceType, data: any): string {
    switch (sourceType) {
      case 'resident_report':
        return '已报修';
      case 'technician_receipt':
        return data.repairResult ? '已完成' : '处理中';
      case 'material_usage':
        return '材料已领用';
      case 'supervisor_note':
        return '主管已批注';
      default:
        return '待处理';
    }
  }

  async withdrawRecord(rawRecordId: string, operator: string): Promise<boolean> {
    const rawRecords = await this.db.getRawRecordsByBatch('');
    const rawRecord = rawRecords.find(r => r.id === rawRecordId);
    if (!rawRecord) {
      return false;
    }

    await this.db.updateRawRecordStatus(rawRecordId, 'withdrawn');
    await this.db.logChange(
      rawRecordId,
      'status',
      rawRecord.status,
      'withdrawn',
      operator,
      '撤回记录'
    );

    return true;
  }
}
