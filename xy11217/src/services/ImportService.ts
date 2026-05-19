import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { RecordStatus, ImportHistory } from '../types';
import { SampleRecordDao } from '../dao/SampleRecordDao';
import { TemperatureRecordDao } from '../dao/TemperatureRecordDao';
import { WasteRecordDao } from '../dao/WasteRecordDao';
import { runQuery, getQuery, allQuery } from '../database';

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

export interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: ImportValidationError[];
  importId: string;
}

export class ImportService {
  private sampleDao: SampleRecordDao;
  private tempDao: TemperatureRecordDao;
  private wasteDao: WasteRecordDao;

  constructor() {
    this.sampleDao = new SampleRecordDao();
    this.tempDao = new TemperatureRecordDao();
    this.wasteDao = new WasteRecordDao();
  }

  private validateSampleRow(row: any, rowNum: number): ImportValidationError[] {
    const errors: ImportValidationError[] = [];

    if (!row.storeId || row.storeId.trim() === '') {
      errors.push({ row: rowNum, field: 'storeId', message: '门店ID不能为空', value: row.storeId });
    }
    if (!row.storeName || row.storeName.trim() === '') {
      errors.push({ row: rowNum, field: 'storeName', message: '门店名称不能为空', value: row.storeName });
    }
    if (!row.dishId || row.dishId.trim() === '') {
      errors.push({ row: rowNum, field: 'dishId', message: '菜品ID不能为空', value: row.dishId });
    }
    if (!row.dishName || row.dishName.trim() === '') {
      errors.push({ row: rowNum, field: 'dishName', message: '菜品名称不能为空', value: row.dishName });
    }
    if (!row.batchNo || row.batchNo.trim() === '') {
      errors.push({ row: rowNum, field: 'batchNo', message: '批次号不能为空', value: row.batchNo });
    }
    if (!row.sampleTime || !dayjs(row.sampleTime).isValid()) {
      errors.push({ row: rowNum, field: 'sampleTime', message: '留样时间格式不正确', value: row.sampleTime });
    }
    if (!row.expireTime || !dayjs(row.expireTime).isValid()) {
      errors.push({ row: rowNum, field: 'expireTime', message: '过期时间格式不正确', value: row.expireTime });
    }
    if (!row.samplePerson || row.samplePerson.trim() === '') {
      errors.push({ row: rowNum, field: 'samplePerson', message: '留样人不能为空', value: row.samplePerson });
    }
    if (!row.storageLocation || row.storageLocation.trim() === '') {
      errors.push({ row: rowNum, field: 'storageLocation', message: '存储位置不能为空', value: row.storageLocation });
    }

    return errors;
  }

  private validateTemperatureRow(row: any, rowNum: number): ImportValidationError[] {
    const errors: ImportValidationError[] = [];

    if (!row.storeId || row.storeId.trim() === '') {
      errors.push({ row: rowNum, field: 'storeId', message: '门店ID不能为空', value: row.storeId });
    }
    if (!row.storeName || row.storeName.trim() === '') {
      errors.push({ row: rowNum, field: 'storeName', message: '门店名称不能为空', value: row.storeName });
    }
    if (!row.fridgeId || row.fridgeId.trim() === '') {
      errors.push({ row: rowNum, field: 'fridgeId', message: '冰箱ID不能为空', value: row.fridgeId });
    }
    if (!row.fridgeName || row.fridgeName.trim() === '') {
      errors.push({ row: rowNum, field: 'fridgeName', message: '冰箱名称不能为空', value: row.fridgeName });
    }
    if (!row.recordTime || !dayjs(row.recordTime).isValid()) {
      errors.push({ row: rowNum, field: 'recordTime', message: '记录时间格式不正确', value: row.recordTime });
    }
    const temp = parseFloat(row.temperature);
    if (isNaN(temp)) {
      errors.push({ row: rowNum, field: 'temperature', message: '温度必须是数字', value: row.temperature });
    }
    const minTemp = parseFloat(row.minTemp);
    if (isNaN(minTemp)) {
      errors.push({ row: rowNum, field: 'minTemp', message: '最低温度必须是数字', value: row.minTemp });
    }
    const maxTemp = parseFloat(row.maxTemp);
    if (isNaN(maxTemp)) {
      errors.push({ row: rowNum, field: 'maxTemp', message: '最高温度必须是数字', value: row.maxTemp });
    }
    if (!row.recordPerson || row.recordPerson.trim() === '') {
      errors.push({ row: rowNum, field: 'recordPerson', message: '记录人不能为空', value: row.recordPerson });
    }

    return errors;
  }

  private validateWasteRow(row: any, rowNum: number): ImportValidationError[] {
    const errors: ImportValidationError[] = [];

    if (!row.storeId || row.storeId.trim() === '') {
      errors.push({ row: rowNum, field: 'storeId', message: '门店ID不能为空', value: row.storeId });
    }
    if (!row.storeName || row.storeName.trim() === '') {
      errors.push({ row: rowNum, field: 'storeName', message: '门店名称不能为空', value: row.storeName });
    }
    if (!row.dishId || row.dishId.trim() === '') {
      errors.push({ row: rowNum, field: 'dishId', message: '菜品ID不能为空', value: row.dishId });
    }
    if (!row.dishName || row.dishName.trim() === '') {
      errors.push({ row: rowNum, field: 'dishName', message: '菜品名称不能为空', value: row.dishName });
    }
    if (!row.batchNo || row.batchNo.trim() === '') {
      errors.push({ row: rowNum, field: 'batchNo', message: '批次号不能为空', value: row.batchNo });
    }
    if (!row.wasteTime || !dayjs(row.wasteTime).isValid()) {
      errors.push({ row: rowNum, field: 'wasteTime', message: '废弃时间格式不正确', value: row.wasteTime });
    }
    const amount = parseFloat(row.wasteAmount);
    if (isNaN(amount)) {
      errors.push({ row: rowNum, field: 'wasteAmount', message: '废弃数量必须是数字', value: row.wasteAmount });
    }
    if (!row.wasteReason || row.wasteReason.trim() === '') {
      errors.push({ row: rowNum, field: 'wasteReason', message: '废弃原因不能为空', value: row.wasteReason });
    }
    if (!row.wastePerson || row.wastePerson.trim() === '') {
      errors.push({ row: rowNum, field: 'wastePerson', message: '废弃人不能为空', value: row.wastePerson });
    }

    return errors;
  }

  async importSampleFromCSV(filePath: string, importedBy: string): Promise<ImportResult> {
    return this.importFromCSV(filePath, importedBy, 'sample');
  }

  async importTemperatureFromCSV(filePath: string, importedBy: string): Promise<ImportResult> {
    return this.importFromCSV(filePath, importedBy, 'temperature');
  }

  async importWasteFromCSV(filePath: string, importedBy: string): Promise<ImportResult> {
    return this.importFromCSV(filePath, importedBy, 'waste');
  }

  private async importFromCSV(
    filePath: string,
    importedBy: string,
    fileType: 'sample' | 'temperature' | 'waste'
  ): Promise<ImportResult> {
    const importId = uuidv4();
    const allErrors: ImportValidationError[] = [];
    const validRecords: any[] = [];
    let rowNum = 0;

    await runQuery(`
      INSERT INTO import_history (id, file_name, file_type, total_records, success_count, failed_count, errors, imported_by, imported_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing')
    `, [importId, path.basename(filePath), fileType, 0, 0, 0, '', importedBy, dayjs().toISOString()]);

    try {
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath, 'utf8')
          .pipe(csv())
          .on('data', (row: any) => {
            rowNum++;
            let errors: ImportValidationError[] = [];

            switch (fileType) {
              case 'sample':
                errors = this.validateSampleRow(row, rowNum);
                break;
              case 'temperature':
                errors = this.validateTemperatureRow(row, rowNum);
                break;
              case 'waste':
                errors = this.validateWasteRow(row, rowNum);
                break;
            }

            if (errors.length > 0) {
              allErrors.push(...errors);
            } else {
              validRecords.push(row);
            }
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      let imported = 0;
      const failed = allErrors.length;
      const total = rowNum;

      if (validRecords.length > 0) {
        switch (fileType) {
          case 'sample':
            const sampleRecords = validRecords.map(row => ({
              storeId: row.storeId.trim(),
              storeName: row.storeName.trim(),
              dishId: row.dishId.trim(),
              dishName: row.dishName.trim(),
              batchNo: row.batchNo.trim(),
              sampleTime: dayjs(row.sampleTime).toISOString(),
              samplePerson: row.samplePerson.trim(),
              samplePersonPhone: row.samplePersonPhone?.trim(),
              expireTime: dayjs(row.expireTime).toISOString(),
              storageLocation: row.storageLocation.trim(),
              status: RecordStatus.PENDING
            }));
            const createdSamples = await this.sampleDao.bulkCreate(sampleRecords);
            imported = createdSamples.length;
            break;

          case 'temperature':
            const tempRecords = validRecords.map(row => ({
              storeId: row.storeId.trim(),
              storeName: row.storeName.trim(),
              fridgeId: row.fridgeId.trim(),
              fridgeName: row.fridgeName.trim(),
              recordTime: dayjs(row.recordTime).toISOString(),
              temperature: parseFloat(row.temperature),
              minTemp: parseFloat(row.minTemp),
              maxTemp: parseFloat(row.maxTemp),
              recordPerson: row.recordPerson.trim(),
              recordPersonPhone: row.recordPersonPhone?.trim(),
              status: RecordStatus.PENDING
            }));
            const createdTemps = await this.tempDao.bulkCreate(tempRecords);
            imported = createdTemps.length;
            break;

          case 'waste':
            const wasteRecords = validRecords.map(row => ({
              storeId: row.storeId.trim(),
              storeName: row.storeName.trim(),
              dishId: row.dishId.trim(),
              dishName: row.dishName.trim(),
              batchNo: row.batchNo.trim(),
              wasteTime: dayjs(row.wasteTime).toISOString(),
              wasteAmount: parseFloat(row.wasteAmount),
              wasteReason: row.wasteReason.trim(),
              wastePerson: row.wastePerson.trim(),
              wastePersonPhone: row.wastePersonPhone?.trim(),
              status: RecordStatus.PENDING
            }));
            const createdWastes = await this.wasteDao.bulkCreate(wasteRecords);
            imported = createdWastes.length;
            break;
        }
      }

      await runQuery(`
        UPDATE import_history 
        SET total_records = ?, success_count = ?, failed_count = ?, errors = ?, status = 'completed'
        WHERE id = ?
      `, [total, imported, failed, JSON.stringify(allErrors), importId]);

      return {
        success: true,
        total,
        imported,
        failed,
        errors: allErrors,
        importId
      };
    } catch (err: any) {
      await runQuery(`
        UPDATE import_history 
        SET total_records = ?, success_count = ?, failed_count = ?, errors = ?, status = 'failed'
        WHERE id = ?
      `, [rowNum, 0, rowNum, err.message, importId]);

      return {
        success: false,
        total: rowNum,
        imported: 0,
        failed: rowNum,
        errors: [{ row: 0, field: 'system', message: err.message, value: '' }],
        importId
      };
    }
  }

  async getImportHistory(limit: number = 50): Promise<ImportHistory[]> {
    const rows = await allQuery(`
      SELECT * FROM import_history ORDER BY imported_at DESC LIMIT ?
    `, [limit]);

    return rows.map((row: any) => ({
      id: row.id,
      fileName: row.file_name,
      fileType: row.file_type as 'sample' | 'temperature' | 'waste',
      totalRecords: row.total_records,
      successCount: row.success_count,
      failedCount: row.failed_count,
      errors: row.errors,
      importedBy: row.imported_by,
      importedAt: row.imported_at,
      status: row.status as 'processing' | 'completed' | 'failed'
    }));
  }

  async getImportHistoryById(id: string): Promise<ImportHistory | null> {
    const row = await getQuery('SELECT * FROM import_history WHERE id = ?', [id]);
    if (!row) return null;

    const r = row as any;
    return {
      id: r.id,
      fileName: r.file_name,
      fileType: r.file_type as 'sample' | 'temperature' | 'waste',
      totalRecords: r.total_records,
      successCount: r.success_count,
      failedCount: r.failed_count,
      errors: r.errors,
      importedBy: r.imported_by,
      importedAt: r.imported_at,
      status: r.status as 'processing' | 'completed' | 'failed'
    };
  }
}
