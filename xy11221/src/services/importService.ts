import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import csv from 'csv-parser';
import { db } from '../models/database';
import { SampleRetention, TemperatureLog, DiscardRecord, ImportStatus, BatchOperationResult } from '../models/types';
import { Validator, ValidationResult } from './validation';

export class ImportService {
  async importSampleRetention(filePath: string, importedBy: string = 'system'): Promise<BatchOperationResult<SampleRetention>> {
    const batchId = db.generateId();
    const importId = db.generateId();
    const successItems: SampleRetention[] = [];
    const failedItems: Array<{ item: Partial<SampleRetention>; error: string; suggestion: string }> = [];

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber - 1] = this.normalizeHeader(cell.value?.toString() || '');
    });

    const rows: any[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        rowData[headers[colNumber - 1]] = cell.value;
      });
      rows.push({ data: rowData, rowNumber });
    });

    for (const { data, rowNumber } of rows) {
      const validation = Validator.validateSampleRetention(data, rowNumber);
      
      if (validation.isValid && validation.data) {
        const item: SampleRetention = {
          ...validation.data,
          id: db.generateId(),
          createdAt: db.now(),
          updatedAt: db.now()
        };

        try {
          await db.run(
            `INSERT INTO sample_retention (
              id, date, dish_name, dish_type, quantity, reserved_by, reserved_at,
              storage_location, discard_date, status, remarks, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id, item.date, item.dishName, item.dishType, item.quantity,
              item.reservedBy, item.reservedAt, item.storageLocation, item.discardDate,
              item.status, item.remarks || '', item.createdAt, item.updatedAt
            ]
          );
          successItems.push(item);
        } catch (err: any) {
          failedItems.push({
            item: data,
            error: err.message,
            suggestion: '数据库插入失败，请检查数据完整性'
          });
        }
      } else {
        failedItems.push({
          item: data,
          error: validation.errors.join('; '),
          suggestion: validation.suggestions.join('; ')
        });

        await db.run(
          `INSERT INTO failed_record (
            id, import_id, row_number, original_data, error_message, suggestion, is_resolved, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            db.generateId(), importId, rowNumber, JSON.stringify(data),
            validation.errors.join('; '), validation.suggestions.join('; '), 0, db.now()
          ]
        );
      }
    }

    const status = successItems.length === 0 ? ImportStatus.FAILED :
                   failedItems.length === 0 ? ImportStatus.SUCCESS : ImportStatus.PARTIAL;

    await db.run(
      `INSERT INTO import_record (
        id, batch_id, import_type, file_name, total_records, success_count, failed_count,
        status, imported_by, imported_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        importId, batchId, 'sample', filePath.split('/').pop() || '',
        rows.length, successItems.length, failedItems.length,
        status, importedBy, db.now(), db.now()
      ]
    );

    return { batchId, total: rows.length, success: successItems.length, failed: failedItems.length, successItems, failedItems };
  }

  async importTemperatureLog(filePath: string, importedBy: string = 'system'): Promise<BatchOperationResult<TemperatureLog>> {
    const batchId = db.generateId();
    const importId = db.generateId();
    const successItems: TemperatureLog[] = [];
    const failedItems: Array<{ item: Partial<TemperatureLog>; error: string; suggestion: string }> = [];
    const rows: Array<{ data: any; rowNumber: number }> = [];

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headers: string[]) => {
          headers.forEach((h, i) => headers[i] = this.normalizeHeader(h));
        })
        .on('data', (data: any) => {
          rows.push({ data, rowNumber: rows.length + 2 });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    for (const { data, rowNumber } of rows) {
      const validation = Validator.validateTemperatureLog(data, rowNumber);

      if (validation.isValid && validation.data) {
        const item: TemperatureLog = {
          ...validation.data,
          id: db.generateId(),
          createdAt: db.now(),
          updatedAt: db.now()
        };

        try {
          await db.run(
            `INSERT INTO temperature_log (
              id, date, refrigerator_id, refrigerator_name, temperature, min_temperature,
              max_temperature, measured_by, measured_at, is_normal, status, remarks, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id, item.date, item.refrigeratorId, item.refrigeratorName,
              item.temperature, item.minTemperature, item.maxTemperature,
              item.measuredBy, item.measuredAt, item.isNormal ? 1 : 0,
              item.status, item.remarks || '', item.createdAt, item.updatedAt
            ]
          );
          successItems.push(item);
        } catch (err: any) {
          failedItems.push({
            item: data,
            error: err.message,
            suggestion: '数据库插入失败，请检查数据完整性'
          });
        }
      } else {
        failedItems.push({
          item: data,
          error: validation.errors.join('; '),
          suggestion: validation.suggestions.join('; ')
        });

        await db.run(
          `INSERT INTO failed_record (
            id, import_id, row_number, original_data, error_message, suggestion, is_resolved, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            db.generateId(), importId, rowNumber, JSON.stringify(data),
            validation.errors.join('; '), validation.suggestions.join('; '), 0, db.now()
          ]
        );
      }
    }

    const status = successItems.length === 0 ? ImportStatus.FAILED :
                   failedItems.length === 0 ? ImportStatus.SUCCESS : ImportStatus.PARTIAL;

    await db.run(
      `INSERT INTO import_record (
        id, batch_id, import_type, file_name, total_records, success_count, failed_count,
        status, imported_by, imported_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        importId, batchId, 'temperature', filePath.split('/').pop() || '',
        rows.length, successItems.length, failedItems.length,
        status, importedBy, db.now(), db.now()
      ]
    );

    return { batchId, total: rows.length, success: successItems.length, failed: failedItems.length, successItems, failedItems };
  }

  async retryFailedImport(importId: string): Promise<BatchOperationResult<any>> {
    const failedRecords = await db.all(
      `SELECT * FROM failed_record WHERE import_id = ? AND is_resolved = 0`,
      [importId]
    );

    if (failedRecords.length === 0) {
      return { batchId: db.generateId(), total: 0, success: 0, failed: 0, successItems: [], failedItems: [] };
    }

    const importRecord = await db.get(`SELECT * FROM import_record WHERE id = ?`, [importId]);
    if (!importRecord) {
      throw new Error('Import record not found');
    }

    const successItems: any[] = [];
    const failedItems: any[] = [];

    for (const record of failedRecords) {
      const data = JSON.parse(record.original_data);
      
      let validation: ValidationResult<any>;
      if (importRecord.import_type === 'sample') {
        validation = Validator.validateSampleRetention(data, record.row_number);
      } else if (importRecord.import_type === 'temperature') {
        validation = Validator.validateTemperatureLog(data, record.row_number);
      } else {
        validation = Validator.validateDiscardRecord(data, record.row_number);
      }

      if (validation.isValid && validation.data) {
        try {
          if (importRecord.import_type === 'sample') {
            const item: SampleRetention = {
              ...validation.data,
              id: db.generateId(),
              createdAt: db.now(),
              updatedAt: db.now()
            };
            await db.run(
              `INSERT INTO sample_retention (
                id, date, dish_name, dish_type, quantity, reserved_by, reserved_at,
                storage_location, discard_date, status, remarks, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                item.id, item.date, item.dishName, item.dishType, item.quantity,
                item.reservedBy, item.reservedAt, item.storageLocation, item.discardDate,
                item.status, item.remarks || '', item.createdAt, item.updatedAt
              ]
            );
            successItems.push(item);
          } else if (importRecord.import_type === 'temperature') {
            const item: TemperatureLog = {
              ...validation.data,
              id: db.generateId(),
              createdAt: db.now(),
              updatedAt: db.now()
            };
            await db.run(
              `INSERT INTO temperature_log (
                id, date, refrigerator_id, refrigerator_name, temperature, min_temperature,
                max_temperature, measured_by, measured_at, is_normal, status, remarks, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                item.id, item.date, item.refrigeratorId, item.refrigeratorName,
                item.temperature, item.minTemperature, item.maxTemperature,
                item.measuredBy, item.measuredAt, item.isNormal ? 1 : 0,
                item.status, item.remarks || '', item.createdAt, item.updatedAt
              ]
            );
            successItems.push(item);
          }

          await db.run(
            `UPDATE failed_record SET is_resolved = 1, resolved_at = ? WHERE id = ?`,
            [db.now(), record.id]
          );
        } catch (err: any) {
          failedItems.push({ item: data, error: err.message, suggestion: '重试失败' });
        }
      } else {
        failedItems.push({
          item: data,
          error: validation.errors.join('; '),
          suggestion: validation.suggestions.join('; ')
        });
      }
    }

    if (successItems.length > 0) {
      await db.run(
        `UPDATE import_record SET success_count = success_count + ?, failed_count = failed_count - ? WHERE id = ?`,
        [successItems.length, successItems.length, importId]
      );
    }

    return {
      batchId: db.generateId(),
      total: failedRecords.length,
      success: successItems.length,
      failed: failedItems.length,
      successItems,
      failedItems
    };
  }

  private normalizeHeader(header: string): string {
    const mapping: Record<string, string> = {
      '日期': 'date',
      '菜品名称': 'dishName',
      '菜品类型': 'dishType',
      '数量': 'quantity',
      '留样人': 'reservedBy',
      '留样时间': 'reservedAt',
      '存放位置': 'storageLocation',
      '废弃日期': 'discardDate',
      '冰箱编号': 'refrigeratorId',
      '冰箱名称': 'refrigeratorName',
      '温度': 'temperature',
      '最低温度': 'minTemperature',
      '最高温度': 'maxTemperature',
      '测量人': 'measuredBy',
      '测量时间': 'measuredAt',
      '物品名称': 'itemName',
      '物品类型': 'itemType',
      '单位': 'unit',
      '废弃原因': 'discardReason',
      '废弃人': 'discardedBy',
      '废弃时间': 'discardedAt',
      '备注': 'remarks'
    };
    return mapping[header.trim()] || header.trim();
  }
}

export const importService = new ImportService();