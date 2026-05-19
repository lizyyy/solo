import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { WarehouseDB } from './database';
import { PartOrder, RepairOrder, ClaimRule, ImportError } from './types';

export interface ImportResult {
  batch: string;
  total: number;
  success: number;
  errors: number;
}

export class ImportService {
  private db: WarehouseDB;

  constructor(db: WarehouseDB) {
    this.db = db;
  }

  generateBatch(): string {
    return `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  async importPartsCsv(filePath: string, importedBy: string = 'system'): Promise<ImportResult> {
    const batch = this.generateBatch();
    const results: any[] = [];
    const errors: ImportError[] = [];
    let rowNumber = 0;

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          results.push({ data, rowNumber });
        })
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });

    let successCount = 0;

    for (const item of results) {
      try {
        const partOrder = this.validatePartOrder(item.data, item.rowNumber, batch, path.basename(filePath));
        if (!(await this.db.partOrderExists(partOrder.orderNo))) {
          await this.db.insertPartOrder(partOrder);
          successCount++;
        } else {
          errors.push({
            importBatch: batch,
            importType: 'parts',
            sourceFile: path.basename(filePath),
            rowNumber: item.rowNumber,
            rawData: JSON.stringify(item.data),
            errorType: 'DUPLICATE',
            errorMessage: `领件单号 ${partOrder.orderNo} 已存在`,
            suggestion: '请检查领件单号是否正确，或使用更新操作',
            resolved: false
          });
        }
      } catch (error: any) {
        errors.push(error);
      }
    }

    for (const error of errors) {
      await this.db.insertImportError(error);
    }

    await this.db.insertImportHistory({
      importBatch: batch,
      importType: 'parts',
      sourceFile: path.basename(filePath),
      totalRecords: results.length,
      successCount,
      errorCount: errors.length,
      importedBy
    });

    return {
      batch,
      total: results.length,
      success: successCount,
      errors: errors.length
    };
  }

  async importRepairJson(filePath: string, importedBy: string = 'system'): Promise<ImportResult> {
    const batch = this.generateBatch();
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const repairs = Array.isArray(data) ? data : [data];
    const errors: ImportError[] = [];
    let successCount = 0;

    for (let i = 0; i < repairs.length; i++) {
      try {
        const repairOrder = this.validateRepairOrder(repairs[i], i + 1, batch, path.basename(filePath));
        if (!(await this.db.repairOrderExists(repairOrder.repairNo))) {
          await this.db.insertRepairOrder(repairOrder);
          successCount++;
        } else {
          errors.push({
            importBatch: batch,
            importType: 'repair',
            sourceFile: path.basename(filePath),
            rowNumber: i + 1,
            rawData: JSON.stringify(repairs[i]),
            errorType: 'DUPLICATE',
            errorMessage: `返修单号 ${repairOrder.repairNo} 已存在`,
            suggestion: '请检查返修单号是否正确，或使用更新操作',
            resolved: false
          });
        }
      } catch (error: any) {
        errors.push(error);
      }
    }

    for (const error of errors) {
      await this.db.insertImportError(error);
    }

    await this.db.insertImportHistory({
      importBatch: batch,
      importType: 'repair',
      sourceFile: path.basename(filePath),
      totalRecords: repairs.length,
      successCount,
      errorCount: errors.length,
      importedBy
    });

    return {
      batch,
      total: repairs.length,
      success: successCount,
      errors: errors.length
    };
  }

  async importRulesJson(filePath: string, importedBy: string = 'system'): Promise<ImportResult> {
    const batch = this.generateBatch();
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const rules = Array.isArray(data) ? data : [data];
    const errors: ImportError[] = [];
    let successCount = 0;

    for (let i = 0; i < rules.length; i++) {
      try {
        const rule = this.validateClaimRule(rules[i], i + 1, batch, path.basename(filePath));
        if (!(await this.db.claimRuleExists(rule.ruleCode))) {
          await this.db.insertClaimRule(rule);
          successCount++;
        } else {
          errors.push({
            importBatch: batch,
            importType: 'rules',
            sourceFile: path.basename(filePath),
            rowNumber: i + 1,
            rawData: JSON.stringify(rules[i]),
            errorType: 'DUPLICATE',
            errorMessage: `规则编号 ${rule.ruleCode} 已存在`,
            suggestion: '请检查规则编号是否正确，或使用更新操作',
            resolved: false
          });
        }
      } catch (error: any) {
        errors.push(error);
      }
    }

    for (const error of errors) {
      await this.db.insertImportError(error);
    }

    await this.db.insertImportHistory({
      importBatch: batch,
      importType: 'rules',
      sourceFile: path.basename(filePath),
      totalRecords: rules.length,
      successCount,
      errorCount: errors.length,
      importedBy
    });

    return {
      batch,
      total: rules.length,
      success: successCount,
      errors: errors.length
    };
  }

  private validatePartOrder(data: any, rowNumber: number, batch: string, sourceFile: string): Omit<PartOrder, 'id' | 'createdAt' | 'updatedAt'> {
    const required = ['orderNo', 'engineerId', 'engineerName', 'partCode', 'partName', 'quantity', 'unit', 'receiveDate', 'workOrderNo', 'customerName', 'customerPhone'];
    const missing = required.filter(field => !data[field]);

    if (missing.length > 0) {
      throw {
        importBatch: batch,
        importType: 'parts',
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'MISSING_FIELD',
        errorMessage: `缺少必填字段: ${missing.join(', ')}`,
        suggestion: `请补充以下字段: ${missing.join(', ')}`,
        resolved: false
      };
    }

    const quantity = parseInt(data.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      throw {
        importBatch: batch,
        importType: 'parts',
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'INVALID_QUANTITY',
        errorMessage: `数量必须是正整数: ${data.quantity}`,
        suggestion: '请将数量修改为正整数',
        resolved: false
      };
    }

    return {
      orderNo: data.orderNo.trim(),
      engineerId: data.engineerId.trim(),
      engineerName: data.engineerName.trim(),
      partCode: data.partCode.trim(),
      partName: data.partName.trim(),
      quantity,
      unit: data.unit.trim(),
      receiveDate: data.receiveDate.trim(),
      workOrderNo: data.workOrderNo.trim(),
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
      status: data.status || 'pending'
    };
  }

  private validateRepairOrder(data: any, rowNumber: number, batch: string, sourceFile: string): Omit<RepairOrder, 'id' | 'createdAt' | 'updatedAt'> {
    const required = ['repairNo', 'workOrderNo', 'engineerId', 'engineerName', 'faultType', 'repairDate'];
    const missing = required.filter(field => !data[field]);

    if (missing.length > 0) {
      throw {
        importBatch: batch,
        importType: 'repair',
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'MISSING_FIELD',
        errorMessage: `缺少必填字段: ${missing.join(', ')}`,
        suggestion: `请补充以下字段: ${missing.join(', ')}`,
        resolved: false
      };
    }

    if (data.partsUsed && !Array.isArray(data.partsUsed)) {
      throw {
        importBatch: batch,
        importType: 'repair',
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'INVALID_FORMAT',
        errorMessage: 'partsUsed 必须是数组格式',
        suggestion: '请将 partsUsed 修改为数组格式',
        resolved: false
      };
    }

    if (data.oldPartsReturned && !Array.isArray(data.oldPartsReturned)) {
      throw {
        importBatch: batch,
        importType: 'repair',
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'INVALID_FORMAT',
        errorMessage: 'oldPartsReturned 必须是数组格式',
        suggestion: '请将 oldPartsReturned 修改为数组格式',
        resolved: false
      };
    }

    return {
      repairNo: data.repairNo.trim(),
      workOrderNo: data.workOrderNo.trim(),
      engineerId: data.engineerId.trim(),
      engineerName: data.engineerName.trim(),
      faultType: data.faultType.trim(),
      faultDescription: data.faultDescription?.trim() || '',
      repairDate: data.repairDate.trim(),
      partsUsed: data.partsUsed || [],
      oldPartsReturned: data.oldPartsReturned || [],
      status: data.status || 'completed'
    };
  }

  private validateClaimRule(data: any, rowNumber: number, batch: string, sourceFile: string): Omit<ClaimRule, 'id' | 'createdAt'> {
    const required = ['ruleCode', 'ruleName', 'partCode', 'partName', 'faultType', 'claimAmount', 'effectiveDate', 'expiryDate'];
    const missing = required.filter(field => !data[field]);

    if (missing.length > 0) {
      throw {
        importBatch: batch,
        importType: 'rules',
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'MISSING_FIELD',
        errorMessage: `缺少必填字段: ${missing.join(', ')}`,
        suggestion: `请补充以下字段: ${missing.join(', ')}`,
        resolved: false
      };
    }

    const claimAmount = parseFloat(data.claimAmount);
    if (isNaN(claimAmount) || claimAmount < 0) {
      throw {
        importBatch: batch,
        importType: 'rules',
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'INVALID_AMOUNT',
        errorMessage: `索赔金额必须是非负数: ${data.claimAmount}`,
        suggestion: '请将索赔金额修改为非负数',
        resolved: false
      };
    }

    return {
      ruleCode: data.ruleCode.trim(),
      ruleName: data.ruleName.trim(),
      partCode: data.partCode.trim(),
      partName: data.partName.trim(),
      faultType: data.faultType.trim(),
      claimAmount,
      requiresOldPart: data.requiresOldPart !== undefined ? data.requiresOldPart : true,
      effectiveDate: data.effectiveDate.trim(),
      expiryDate: data.expiryDate.trim(),
      status: data.status || 'active'
    };
  }
}
