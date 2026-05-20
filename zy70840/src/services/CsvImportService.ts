import * as csvParser from 'csv-parser';
import { Readable } from 'stream';
import Application, { ApplicationStatus } from '../models/Application';
import BatchService from './BatchService';
import dayjs from 'dayjs';

export interface CsvRow {
  applicationNo?: string;
  merchantName: string;
  contactPerson: string;
  contactPhone: string;
  stallType: string;
  stallLocation: string;
  startDate: string;
  endDate: string;
  depositAmount?: string;
  certificateVersion?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string; data: CsvRow }>;
  imported: Array<{ id: number; applicationNo: string }>;
}

class CsvImportService {
  async parseCsv(fileBuffer: Buffer): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
      const results: CsvRow[] = [];
      const readable = Readable.from(fileBuffer);
      readable
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  validateRow(row: CsvRow, index: number): string | null {
    if (!row.merchantName?.trim()) {
      return `第 ${index + 1} 行：商户名称不能为空`;
    }
    if (!row.contactPerson?.trim()) {
      return `第 ${index + 1} 行：联系人不能为空`;
    }
    if (!row.contactPhone?.trim()) {
      return `第 ${index + 1} 行：联系电话不能为空`;
    }
    if (!row.stallType?.trim()) {
      return `第 ${index + 1} 行：摊位类型不能为空`;
    }
    if (!row.stallLocation?.trim()) {
      return `第 ${index + 1} 行：摊位位置不能为空`;
    }
    if (!row.startDate?.trim()) {
      return `第 ${index + 1} 行：开始日期不能为空`;
    }
    if (!row.endDate?.trim()) {
      return `第 ${index + 1} 行：结束日期不能为空`;
    }
    const startDate = dayjs(row.startDate);
    const endDate = dayjs(row.endDate);
    if (!startDate.isValid()) {
      return `第 ${index + 1} 行：开始日期格式不正确`;
    }
    if (!endDate.isValid()) {
      return `第 ${index + 1} 行：结束日期格式不正确`;
    }
    if (startDate.isAfter(endDate)) {
      return `第 ${index + 1} 行：开始日期不能晚于结束日期`;
    }
    return null;
  }

  async importBatch(
    batchId: number,
    rows: CsvRow[],
    operator: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      imported: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const error = this.validateRow(row, i);

      if (error) {
        result.failed++;
        result.errors.push({ row: i + 1, message: error, data: row });
        continue;
      }

      try {
        const applicationNo = row.applicationNo || `APP${dayjs().format('YYYYMMDDHHmmss')}${String(i + 1).padStart(4, '0')}`;
        
        const application = await Application.create({
          batchId,
          applicationNo,
          merchantName: row.merchantName.trim(),
          contactPerson: row.contactPerson.trim(),
          contactPhone: row.contactPhone.trim(),
          stallType: row.stallType.trim(),
          stallLocation: row.stallLocation.trim(),
          startDate: dayjs(row.startDate).toDate(),
          endDate: dayjs(row.endDate).toDate(),
          depositAmount: parseFloat(row.depositAmount || '0'),
          status: ApplicationStatus.PENDING,
          certificateVersion: row.certificateVersion?.trim() || null,
          importedAt: new Date(),
        });

        result.success++;
        result.imported.push({ id: application.id, applicationNo });
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          message: err.message || '导入失败',
          data: row,
        });
      }
    }

    await BatchService.incrementCounts(batchId, result.success, result.failed);

    return result;
  }

  async importFromBuffer(
    batchId: number,
    fileBuffer: Buffer,
    operator: string
  ): Promise<ImportResult> {
    const rows = await this.parseCsv(fileBuffer);
    return this.importBatch(batchId, rows, operator);
  }
}

export default new CsvImportService();
