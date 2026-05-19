import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { inventoryModel } from '../models/Inventory';
import { medicineModel } from '../models/Medicine';
import { badRecordModel } from '../models/BadRecord';
import { importSessionModel } from '../models/ImportSession';
import { InventoryStatus } from '../types';
import { withTransaction } from '../db/database';

interface InventoryImportRecord {
  medicineCode: string;
  batchNumber: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  manufactureDate: string;
  expiryDate: string;
  location?: string;
  supplier?: string;
}

export class InventoryImporter {
  private sourceFile: string;
  private operatorId: string;
  private operatorName: string;

  constructor(sourceFile: string, operatorId: string, operatorName: string) {
    this.sourceFile = sourceFile;
    this.operatorId = operatorId;
    this.operatorName = operatorName;
  }

  import(): { sessionId: string; successCount: number; failureCount: number; badRecords: any[] } {
    const content = fs.readFileSync(this.sourceFile, 'utf8');
    const fileHash = importSessionModel.calculateFileHash(content);

    const existingSession = importSessionModel.findByFileHash('inventory', fileHash);
    if (existingSession && existingSession.status === 'completed') {
      throw new Error(`该文件已在 ${new Date(existingSession.startedAt).toLocaleString()} 成功导入，避免重复导入`);
    }

    const records = this.parseCSV(content);
    const session = importSessionModel.create({
      importType: 'inventory',
      sourceFile: path.basename(this.sourceFile),
      fileHash,
      totalRecords: records.length,
      successCount: 0,
      failureCount: 0,
      status: 'processing',
      operatorId: this.operatorId,
      operatorName: this.operatorName,
    });

    let successCount = 0;
    let failureCount = 0;
    const badRecords: any[] = [];

    withTransaction(() => {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2;

        try {
          this.validateRecord(record, rowNumber);
          this.importRecord(record);
          successCount++;
        } catch (error: any) {
          const badRecord = badRecordModel.create({
            importId: session.id,
            importType: 'inventory',
            sourceFile: path.basename(this.sourceFile),
            rowNumber,
            columnName: error.columnName,
            originalData: JSON.stringify(record),
            failureReason: error.message,
            suggestedFix: error.suggestedFix || '请检查数据格式',
          });
          badRecords.push(badRecord);
          failureCount++;
        }
      }

      importSessionModel.complete(session.id, successCount, failureCount);
    });

    return { sessionId: session.id, successCount, failureCount, badRecords };
  }

  private parseCSV(content: string): InventoryImportRecord[] {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    return records.map((row: any) => ({
      medicineCode: row['药品编码'] || row['medicineCode'] || '',
      batchNumber: row['批号'] || row['batchNumber'] || '',
      quantity: row['数量'] || row['quantity'] || '',
      unit: row['单位'] || row['unit'] || '',
      unitPrice: row['单价'] || row['unitPrice'] || '',
      manufactureDate: row['生产日期'] || row['manufactureDate'] || '',
      expiryDate: row['有效期'] || row['expiryDate'] || '',
      location: row['库位'] || row['location'],
      supplier: row['供应商'] || row['supplier'],
    }));
  }

  private validateRecord(record: InventoryImportRecord, rowNumber: number): void {
    const errors: string[] = [];
    let columnName: string | undefined;

    if (!record.medicineCode.trim()) {
      errors.push('药品编码不能为空');
      columnName = 'medicineCode';
    }

    if (!record.batchNumber.trim()) {
      errors.push('批号不能为空');
      columnName = columnName || 'batchNumber';
    }

    const quantity = parseFloat(record.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('数量必须为正数');
      columnName = columnName || 'quantity';
    }

    if (!record.unit.trim()) {
      errors.push('单位不能为空');
      columnName = columnName || 'unit';
    }

    const unitPrice = parseFloat(record.unitPrice);
    if (isNaN(unitPrice) || unitPrice < 0) {
      errors.push('单价必须为非负数');
      columnName = columnName || 'unitPrice';
    }

    if (!this.isValidDate(record.manufactureDate)) {
      errors.push('生产日期格式不正确（应为YYYY-MM-DD）');
      columnName = columnName || 'manufactureDate';
    }

    if (!this.isValidDate(record.expiryDate)) {
      errors.push('有效期格式不正确（应为YYYY-MM-DD）');
      columnName = columnName || 'expiryDate';
    }

    if (errors.length > 0) {
      const error: any = new Error(errors.join('; '));
      error.columnName = columnName;
      error.suggestedFix = this.getSuggestedFix(columnName);
      throw error;
    }
  }

  private isValidDate(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  }

  private getSuggestedFix(columnName?: string): string {
    const fixes: Record<string, string> = {
      medicineCode: '请填写正确的药品编码，可在药品列表中查询',
      batchNumber: '请填写药品批次号，格式如202401001',
      quantity: '请填写正数数量，例如10、5.5',
      unit: '请填写药品单位，例如片、瓶、盒',
      unitPrice: '请填写非负数价格，例如9.99、100',
      manufactureDate: '请按YYYY-MM-DD格式填写生产日期，例如2024-01-15',
      expiryDate: '请按YYYY-MM-DD格式填写有效期，例如2026-01-15',
    };
    return fixes[columnName || ''] || '请检查数据格式是否正确';
  }

  private importRecord(record: InventoryImportRecord): void {
    const medicine = medicineModel.findByCode(record.medicineCode);
    if (!medicine) {
      const error: any = new Error(`药品编码 ${record.medicineCode} 不存在`);
      error.columnName = 'medicineCode';
      error.suggestedFix = '请先创建该药品，或使用正确的药品编码';
      throw error;
    }

    const existing = inventoryModel.findByBatchNumber(medicine.id, record.batchNumber);
    if (existing) {
      inventoryModel.addStock(existing.id, parseFloat(record.quantity));
      return;
    }

    inventoryModel.create({
      medicineId: medicine.id,
      batchNumber: record.batchNumber,
      quantity: parseFloat(record.quantity),
      unit: record.unit,
      unitPrice: parseFloat(record.unitPrice),
      manufactureDate: record.manufactureDate,
      expiryDate: record.expiryDate,
      status: InventoryStatus.IN_STOCK,
      location: record.location,
      supplier: record.supplier,
    });
  }
}