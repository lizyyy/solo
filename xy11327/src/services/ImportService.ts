import fs from 'fs';
import csv from 'csv-parser';
import { WorkRecord, BatchResult } from '../types';
import { WorkRecordRepository } from '../repositories/WorkRecordRepository';
import { logger } from '../utils/logger';

export class ImportService {
  private repository: WorkRecordRepository;

  constructor(repository?: WorkRecordRepository) {
    this.repository = repository || new WorkRecordRepository();
  }

  public async importFromCsv(filePath: string): Promise<BatchResult<WorkRecord>> {
    const records = await this.parseCsv(filePath);
    logger.info(`CSV解析完成，共 ${records.length} 条记录`);

    const result = this.repository.batchInsert(records);

    logger.info(`导入完成: 成功 ${result.success.length} 条，失败 ${result.failed.length} 条`);

    return {
      success: result.success,
      failed: result.failed.map(f => ({
        item: f.record,
        error: f.error,
        index: f.index
      })),
      total: records.length,
      successCount: result.success.length,
      failedCount: result.failed.length
    };
  }

  private async parseCsv(filePath: string): Promise<WorkRecord[]> {
    return new Promise((resolve, reject) => {
      const records: WorkRecord[] = [];

      if (!fs.existsSync(filePath)) {
        reject(new Error(`文件不存在: ${filePath}`));
        return;
      }

      fs.createReadStream(filePath)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim()
        }))
        .on('data', (data) => {
          try {
            const record = this.mapCsvRowToRecord(data);
            records.push(record);
          } catch (error: any) {
            logger.warn(`解析行失败: ${error.message}`);
          }
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private mapCsvRowToRecord(row: any): WorkRecord {
    const billingType = this.parseBillingType(row.billingType || row['计费方式'] || 'hourly');

    return {
      recordNo: (row.recordNo || row['记录编号'] || '').trim(),
      tractorNo: (row.tractorNo || row['拖拉机编号'] || '').trim(),
      operatorName: (row.operatorName || row['机手姓名'] || '').trim(),
      operatorIdCard: (row.operatorIdCard || row['身份证号'] || '').trim() || undefined,
      operatorPhone: (row.operatorPhone || row['电话'] || '').trim() || undefined,
      workDate: (row.workDate || row['作业日期'] || '').trim(),
      workType: (row.workType || row['作业类型'] || '').trim(),
      billingType,
      hours: this.parseNumber(row.hours || row['小时数']),
      acreage: this.parseNumber(row.acreage || row['亩数']),
      fuelUsed: this.parseNumber(row.fuelUsed || row['油量']),
      fuelPrice: this.parseNumber(row.fuelPrice || row['油价']),
      hourlyRate: this.parseNumber(row.hourlyRate || row['小时单价']),
      acreageRate: this.parseNumber(row.acreageRate || row['亩单价']),
      remarks: (row.remarks || row['备注'] || '').trim() || undefined,
      status: 'pending'
    };
  }

  private parseBillingType(value: string): WorkRecord['billingType'] {
    const normalized = value.toLowerCase().trim();
    if (['hourly', '小时', '按时'].includes(normalized)) return 'hourly';
    if (['acreage', '亩', '按亩'].includes(normalized)) return 'acreage';
    if (['fuel', '油', '按油'].includes(normalized)) return 'fuel';
    if (['mixed', '混合'].includes(normalized)) return 'mixed';
    return 'hourly';
  }

  private parseNumber(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
}
