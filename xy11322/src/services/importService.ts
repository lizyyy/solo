import fs from 'fs';
import csv from 'csv-parser';
import {
  WorkRecord,
  ImportOptions,
  ImportResult,
  ImportError,
  ExceptionInfo,
  BillingType,
} from '../types';
import { dataStore } from '../store';
import { REQUIRED_FIELDS, BILLING_TYPES, DEFAULT_CONFIG } from '../config';

export class ImportService {
  async importCSV(options: ImportOptions): Promise<ImportResult> {
    const results: ImportResult = {
      total: 0,
      success: 0,
      failed: 0,
      duplicates: 0,
      records: [],
      errors: [],
    };

    const rows: Record<string, any>[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(options.filePath)
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', async () => {
          results.total = rows.length;

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            const validation = this.validateRow(row, rowNum);

            if (validation.errors.length > 0) {
              results.failed++;
              results.errors.push({
                row: rowNum,
                recordNo: row.recordNo,
                errors: validation.errors,
                data: row,
              });
              continue;
            }

            if (dataStore.recordExists(row.recordNo)) {
              if (options.skipDuplicates) {
                results.duplicates++;
                continue;
              }
              results.failed++;
              results.errors.push({
                row: rowNum,
                recordNo: row.recordNo,
                errors: [`记录编号 ${row.recordNo} 已存在`],
                data: row,
              });
              continue;
            }

            if (!options.validateOnly) {
              const record = this.createRecordFromRow(row, options.operator);
              results.records.push(record);
              results.success++;
            } else {
              results.success++;
            }
          }

          dataStore.addAuditLog('import_csv', options.operator, {
            filePath: options.filePath,
            total: results.total,
            success: results.success,
            failed: results.failed,
            duplicates: results.duplicates,
          });

          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private validateRow(row: Record<string, any>, rowNum: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      if (row[field] === undefined || row[field] === null || row[field] === '') {
        errors.push(`缺少必填字段: ${field}`);
      }
    }

    if (row.billingType && !BILLING_TYPES.includes(row.billingType)) {
      errors.push(`计费类型无效: ${row.billingType}, 应为: ${BILLING_TYPES.join(', ')}`);
    }

    if (row.startTime) {
      const startTime = new Date(row.startTime);
      if (isNaN(startTime.getTime())) {
        errors.push(`开始时间格式无效: ${row.startTime}`);
      }
    }

    if (row.endTime) {
      const endTime = new Date(row.endTime);
      if (isNaN(endTime.getTime())) {
        errors.push(`结束时间格式无效: ${row.endTime}`);
      }
    }

    if (row.workHours !== undefined && row.workHours !== '') {
      const hours = parseFloat(row.workHours);
      if (isNaN(hours) || hours < 0) {
        errors.push(`工作小时数无效: ${row.workHours}`);
      }
    }

    if (row.workArea !== undefined && row.workArea !== '') {
      const area = parseFloat(row.workArea);
      if (isNaN(area) || area < 0) {
        errors.push(`作业面积无效: ${row.workArea}`);
      }
    }

    if (row.fuelConsumption !== undefined && row.fuelConsumption !== '') {
      const fuel = parseFloat(row.fuelConsumption);
      if (isNaN(fuel) || fuel < 0) {
        errors.push(`油耗无效: ${row.fuelConsumption}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private createRecordFromRow(row: Record<string, any>, operator: string): WorkRecord {
    const config = dataStore.getConfig();
    const exceptions: ExceptionInfo[] = [];

    const startTime = new Date(row.startTime);
    const endTime = new Date(row.endTime);
    const workHours = parseFloat(row.workHours) || 0;
    const workArea = parseFloat(row.workArea) || 0;
    const fuelConsumption = parseFloat(row.fuelConsumption) || 0;
    const billingType = row.billingType as BillingType;
    const hourlyRate = parseFloat(row.hourlyRate) || config.defaultHourlyRate;
    const areaRate = parseFloat(row.areaRate) || config.defaultAreaRate;
    const fuelRate = parseFloat(row.fuelRate) || config.defaultFuelRate;
    const minimumCharge = parseFloat(row.minimumCharge) || config.defaultMinimumCharge;

    let totalAmount = 0;
    switch (billingType) {
      case 'hourly':
        totalAmount = workHours * hourlyRate;
        break;
      case 'area':
        totalAmount = workArea * areaRate;
        break;
      case 'fuel':
        totalAmount = fuelConsumption * fuelRate;
        break;
      case 'mixed':
        totalAmount = workHours * hourlyRate + workArea * areaRate + fuelConsumption * fuelRate;
        break;
    }

    const record = dataStore.addRecord(
      {
        recordNo: row.recordNo,
        operator: row.operator,
        tractorNo: row.tractorNo,
        operatorName: row.operatorName,
        startTime,
        endTime,
        workHours,
        workArea,
        fuelConsumption,
        billingType,
        hourlyRate,
        areaRate,
        fuelRate,
        minimumCharge,
        status: 'pending',
        totalAmount,
        calculatedAmount: 0,
        finalAmount: 0,
        exceptions,
        createdBy: operator,
        updatedBy: operator,
        isBilled: false,
      },
      operator
    );

    return record;
  }
}

export const importService = new ImportService();
