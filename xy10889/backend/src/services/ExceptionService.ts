import { ExceptionRecord, ExceptionType, SampleStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { runInsert, runQuery, runGet } from '../database';
import { SampleService } from './SampleService';

export class ExceptionService {
  static async reportException(data: {
    sampleId?: string;
    batchId?: string;
    type: ExceptionType;
    description: string;
    reportedBy: string;
  }): Promise<ExceptionRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const record: ExceptionRecord = {
      ...data,
      id,
      reportedAt: now,
      resolved: false
    };

    await runInsert(
      `INSERT INTO exceptionRecords (id, sampleId, batchId, type, description, reportedBy, reportedAt, resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.sampleId || null, data.batchId || null, data.type, data.description, data.reportedBy, now, 0]
    );

    if (data.sampleId) {
      const sample = await SampleService.getSampleById(data.sampleId);
      if (sample && sample.status !== SampleStatus.EXCEPTION) {
        await SampleService.updateSampleStatus(data.sampleId, SampleStatus.EXCEPTION, data.reportedBy, data.description);
      }
    }

    return record;
  }

  static async resolveException(exceptionId: string, resolvedBy: string, resolution: string): Promise<ExceptionRecord> {
    const exception = await this.getExceptionById(exceptionId);
    if (!exception) {
      throw new Error('异常记录不存在');
    }

    const now = new Date().toISOString();
    await runInsert(
      'UPDATE exceptionRecords SET resolved = 1, resolvedAt = ?, resolvedBy = ?, resolution = ? WHERE id = ?',
      [now, resolvedBy, resolution, exceptionId]
    );

    return { ...exception, resolved: true, resolvedAt: now, resolvedBy, resolution };
  }

  static async getExceptionById(id: string): Promise<ExceptionRecord | null> {
    return runGet('SELECT * FROM exceptionRecords WHERE id = ?', [id]);
  }

  static async getExceptions(filters?: { sampleId?: string; batchId?: string; resolved?: boolean }): Promise<ExceptionRecord[]> {
    let sql = 'SELECT * FROM exceptionRecords WHERE 1=1';
    const params: any[] = [];

    if (filters?.sampleId) {
      sql += ' AND sampleId = ?';
      params.push(filters.sampleId);
    }
    if (filters?.batchId) {
      sql += ' AND batchId = ?';
      params.push(filters.batchId);
    }
    if (filters?.resolved !== undefined) {
      sql += ' AND resolved = ?';
      params.push(filters.resolved ? 1 : 0);
    }
    sql += ' ORDER BY reportedAt DESC';

    return runQuery(sql, params);
  }

  static async manualCompensate(sampleId: string, newStatus: SampleStatus, handler: string, notes: string): Promise<void> {
    const sample = await SampleService.getSampleById(sampleId);
    if (!sample) {
      throw new Error('样本不存在');
    }

    if (sample.status !== SampleStatus.EXCEPTION && sample.status !== SampleStatus.LOST) {
      throw new Error('只有异常或丢失状态的样本才能手动补偿');
    }

    await SampleService.updateSampleStatus(sampleId, newStatus, handler, `手动补偿: ${notes}`);
  }
}
