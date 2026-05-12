import Papa from 'papaparse';
import { Readable } from 'stream';
import {
  Registration,
  ImportBatch,
  Activity,
  StatusHistory
} from '../models';
import { ImportStatus } from '../models/ImportBatch';
import {
  RegistrationStatus,
  LogAction,
  LogEntity
} from '../types';
import { AuditService } from './auditService';
import { sequelize } from '../config/database';
import { Transaction, Op } from 'sequelize';

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRY_COUNT
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await delay(RETRY_DELAY * attempt);
      }
    }
  }

  throw lastError!;
}

export interface ImportResult {
  batchId: string;
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: any }>;
  duplicateSkips: number;
}

export interface ExportOptions {
  activityId?: string;
  status?: RegistrationStatus;
  startDate?: Date;
  endDate?: Date;
  includeHistory?: boolean;
}

export class ImportExportService {
  static async validateCsvFile(fileBuffer: Buffer): Promise<Papa.ParseResult<any>> {
    return new Promise((resolve, reject) => {
      Papa.parse(fileBuffer.toString('utf-8'), {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results),
        error: (error: any) => reject(error)
      });
    });
  }

  static async importFromCsv(
    fileBuffer: Buffer,
    activityId: string,
    userId: string,
    fileName: string
  ): Promise<ImportResult> {
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw new Error('活动不存在');
    }

    const parseResult = await this.validateCsvFile(fileBuffer);
    const records = parseResult.data;
    const errors: Array<{ row: number; error: string; data: any }> = [];
    let success = 0;
    let failed = 0;
    let duplicateSkips = 0;

    const batch = await ImportBatch.create({
      fileName,
      totalRecords: records.length,
      status: ImportStatus.PROCESSING,
      importedBy: userId
    });

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2;

      try {
        if (!row.name || !row.email) {
          throw new Error('缺少必填字段: name 或 email');
        }

        const existing = await Registration.findOne({
          where: {
            activityId,
            email: row.email.trim()
          }
        });

        if (existing) {
          duplicateSkips++;
          continue;
        }

        await retry(async () => {
          const t = await sequelize.transaction();
          try {
            const registration = await Registration.create(
              {
                activityId,
                name: row.name?.trim(),
                email: row.email?.trim(),
                phone: row.phone?.trim() || null,
                company: row.company?.trim() || null,
                notes: row.notes?.trim() || null,
                status: RegistrationStatus.PENDING,
                registrationTime: new Date(),
                createdBy: userId
              },
              { transaction: t }
            );

            await StatusHistory.create(
              {
                registrationId: registration.id,
                newStatus: RegistrationStatus.PENDING,
                changedBy: userId,
                reason: '批量导入'
              },
              { transaction: t }
            );

            await t.commit();
          } catch (error) {
            await t.rollback();
            throw error;
          }
        });

        success++;
      } catch (error: any) {
        failed++;
        errors.push({
          row: rowNumber,
          error: error.message,
          data: {
            ...row,
            activityId
          }
        });
      }
    }

    const finalStatus =
      failed === 0
        ? ImportStatus.COMPLETED
        : success === 0
        ? ImportStatus.FAILED
        : ImportStatus.PARTIAL;

    await batch.update({
      successCount: success,
      failureCount: failed,
      status: finalStatus,
      errorLog: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null
    });

    await AuditService.log(
      LogAction.IMPORT,
      LogEntity.IMPORT_BATCH,
      batch.id,
      userId,
      undefined,
      {
        fileName,
        activityId,
        total: records.length,
        success,
        failed,
        duplicateSkips
      }
    );

    return {
      batchId: batch.id,
      total: records.length,
      success,
      failed,
      errors,
      duplicateSkips
    };
  }

  static async exportToCsv(options: ExportOptions): Promise<{
    csv: string;
    filename: string;
    count: number;
  }> {
    const where: any = {};
    if (options.activityId) where.activityId = options.activityId;
    if (options.status) where.status = options.status;
    if (options.startDate) {
      where.registrationTime = { [Op.gte]: options.startDate };
    }
    if (options.endDate) {
      where.registrationTime = {
        ...where.registrationTime,
        [Op.lte]: options.endDate
      };
    }

    const registrations = await Registration.findAll({
      where,
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name']
        }
      ],
      order: [['registrationTime', 'DESC']]
    });

    const csvData = registrations.map((r) => ({
      报名ID: r.id,
      活动名称: (r as any).activity?.name || '',
      姓名: r.name,
      邮箱: r.email,
      电话: r.phone || '',
      公司: r.company || '',
      状态: r.status,
      报名时间: r.registrationTime.toISOString(),
      备注: r.notes || ''
    }));

    const csv = Papa.unparse(csvData);
    const filename = `registrations_${Date.now()}.csv`;

    await AuditService.log(
      LogAction.EXPORT,
      LogEntity.REGISTRATION,
      'export-' + Date.now(),
      undefined,
      undefined,
      {
        filters: options,
        count: registrations.length
      }
    );

    return {
      csv,
      filename,
      count: registrations.length
    };
  }

  static async retryFailedBatch(
    batchId: string,
    userId: string
  ): Promise<ImportResult | null> {
    const batch = await ImportBatch.findByPk(batchId);
    if (!batch) {
      return null;
    }

    if (
      batch.status !== ImportStatus.FAILED &&
      batch.status !== ImportStatus.PARTIAL
    ) {
      return null;
    }

    if (!batch.errorLog) {
      return null;
    }

    let errors: Array<{ row: number; error: string; data: any }> = [];
    try {
      errors = JSON.parse(batch.errorLog);
    } catch {
      return null;
    }

    const failedRecords = errors.map((e) => e.data);

    const results: Array<{ row: number; error: string; data: any }> = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < failedRecords.length; i++) {
      const row = failedRecords[i];

      try {
        const existing = await Registration.findOne({
          where: {
            activityId: row.activityId,
            email: row.email?.trim()
          }
        });

        if (existing) {
          continue;
        }

        await retry(async () => {
          const t = await sequelize.transaction();
          try {
            const registration = await Registration.create(
              {
                activityId: row.activityId,
                name: row.name?.trim(),
                email: row.email?.trim(),
                phone: row.phone?.trim() || null,
                company: row.company?.trim() || null,
                notes: row.notes?.trim() || null,
                status: RegistrationStatus.PENDING,
                registrationTime: new Date(),
                createdBy: userId
              },
              { transaction: t }
            );

            await StatusHistory.create(
              {
                registrationId: registration.id,
                newStatus: RegistrationStatus.PENDING,
                changedBy: userId,
                reason: '重试导入'
              },
              { transaction: t }
            );

            await t.commit();
          } catch (error) {
            await t.rollback();
            throw error;
          }
        });

        success++;
      } catch (error: any) {
        failed++;
        results.push({
          row: i + 1,
          error: error.message,
          data: row
        });
      }
    }

    await batch.update({
      successCount: batch.successCount + success,
      failureCount: failed,
      status:
        failed === 0
          ? ImportStatus.COMPLETED
          : ImportStatus.PARTIAL
    });

    await AuditService.log(
      LogAction.BATCH_OPERATION,
      LogEntity.IMPORT_BATCH,
      batch.id,
      userId,
      undefined,
      {
        action: 'retry',
        originalBatchId: batchId,
        success,
        failed
      }
    );

    return {
      batchId,
      total: failedRecords.length,
      success,
      failed,
      errors: results,
      duplicateSkips: 0
    };
  }

  static async getImportHistory(userId?: string): Promise<ImportBatch[]> {
    const where: any = {};
    if (userId) where.importedBy = userId;

    return ImportBatch.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 50
    });
  }
}
