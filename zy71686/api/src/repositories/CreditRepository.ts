import { getDb } from '../db/index.js';
import type { CreditLine, ImportBatch, DataImportWarning, BatchTask, FailedItem } from '../../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class CreditRepository {
  createCreditLine(credit: Omit<CreditLine, 'createdAt' | 'updatedAt'> & Partial<Pick<CreditLine, 'id' | 'createdAt' | 'updatedAt'>>): CreditLine {
    const db = getDb();
    const id = (credit as CreditLine).id || uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO credit_line (
        id, customer_id, total_amount, used_amount, available_amount,
        as_of_date, currency, attributes, version, source_file,
        source_row, source_batch, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      credit.customerId,
      credit.totalAmount,
      credit.usedAmount || 0,
      credit.availableAmount || credit.totalAmount - (credit.usedAmount || 0),
      credit.asOfDate,
      credit.currency || 'CNY',
      JSON.stringify(credit.attributes || {}),
      credit.version,
      credit.sourceFile,
      credit.sourceRow,
      credit.sourceBatch,
      now,
      now
    );
    
    return { ...credit, id, createdAt: now, updatedAt: now };
  }

  bulkCreateCreditLines(credits: (Omit<CreditLine, 'createdAt' | 'updatedAt'> & Partial<Pick<CreditLine, 'id' | 'createdAt' | 'updatedAt'>>)[]): CreditLine[] {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO credit_line (
        id, customer_id, total_amount, used_amount, available_amount,
        as_of_date, currency, attributes, version, source_file,
        source_row, source_batch, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result: CreditLine[] = [];
    
    const insertMany = db.transaction((items: any[]) => {
      for (const c of items) {
        const id = c.id || uuidv4();
        stmt.run(
          id,
          c.customerId,
          c.totalAmount,
          c.usedAmount || 0,
          c.availableAmount || c.totalAmount - (c.usedAmount || 0),
          c.asOfDate,
          c.currency || 'CNY',
          JSON.stringify(c.attributes || {}),
          c.version,
          c.sourceFile,
          c.sourceRow,
          c.sourceBatch,
          now,
          now
        );
        result.push({ ...c, id, createdAt: now, updatedAt: now });
      }
    });
    
    insertMany(credits);
    return result;
  }

  findCreditLineById(id: string, version?: string): CreditLine | null {
    const db = getDb();
    let sql = 'SELECT * FROM credit_line WHERE id = ?';
    const params: any[] = [id];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    const row = db.prepare(sql).get(...params) as any;
    return row ? this.mapToCreditLine(row) : null;
  }

  findByCustomerId(customerId: string, version?: string): CreditLine[] {
    const db = getDb();
    let sql = 'SELECT * FROM credit_line WHERE customer_id = ?';
    const params: any[] = [customerId];
    
    if (version) {
      sql += ' AND version = ?';
      params.push(version);
    }
    
    sql += ' ORDER BY as_of_date DESC';
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToCreditLine(row));
  }

  findAllCreditLines(version?: string): CreditLine[] {
    const db = getDb();
    let sql = 'SELECT * FROM credit_line';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapToCreditLine(row));
  }

  countCreditLines(version?: string): number {
    const db = getDb();
    let sql = 'SELECT COUNT(*) as count FROM credit_line';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    const row = db.prepare(sql).get(...params) as any;
    return row.count;
  }

  getTotalExposure(version?: string): number {
    const db = getDb();
    let sql = 'SELECT SUM(used_amount) as total FROM credit_line';
    const params: any[] = [];
    
    if (version) {
      sql += ' WHERE version = ?';
      params.push(version);
    }
    
    const row = db.prepare(sql).get(...params) as any;
    return row.total || 0;
  }

  findDateAnomalies(version?: string): { type: string; objects: CreditLine[]; message: string }[] {
    const db = getDb();
    const anomalies: { type: string; objects: CreditLine[]; message: string }[] = [];
    
    let sql = 'SELECT * FROM credit_line';
    if (version) {
      sql += ' WHERE version = ?';
    }
    
    const rows = db.prepare(sql).all(...(version ? [version] : [])) as any[];
    const credits = rows.map(row => this.mapToCreditLine(row));
    
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    const outOfRange: CreditLine[] = [];
    for (const credit of credits) {
      const asOfDate = new Date(credit.asOfDate);
      if (asOfDate < ninetyDaysAgo || asOfDate > ninetyDaysLater) {
        outOfRange.push(credit);
      }
    }
    
    if (outOfRange.length > 0) {
      anomalies.push({
        type: 'date_out_of_range',
        objects: outOfRange,
        message: `发现 ${outOfRange.length} 条授信余额日期超出合理范围（±90天）`
      });
    }
    
    const customerDates = new Map<string, Date[]>();
    for (const credit of credits) {
      const dates = customerDates.get(credit.customerId) || [];
      dates.push(new Date(credit.asOfDate));
      customerDates.set(credit.customerId, dates);
    }
    
    const largeSpan: CreditLine[] = [];
    for (const [customerId, dates] of customerDates) {
      if (dates.length >= 2) {
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        const spanDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (spanDays > 30) {
          const customerCredits = credits.filter(c => c.customerId === customerId);
          largeSpan.push(...customerCredits);
        }
      }
    }
    
    if (largeSpan.length > 0) {
      anomalies.push({
        type: 'date_span_too_large',
        objects: largeSpan,
        message: `发现 ${largeSpan.length} 条授信余额日期跨度超过30天`
      });
    }
    
    return anomalies;
  }

  findCreditLinesByCustomer(customerId: string, version?: string): CreditLine[] {
    return this.findByCustomerId(customerId, version);
  }

  createImportBatch(batch: Omit<ImportBatch, 'id' | 'uploadTime'> & Partial<Pick<ImportBatch, 'id' | 'uploadTime'>>): ImportBatch {
    const db = getDb();
    const id = (batch as ImportBatch).id || uuidv4();
    const uploadTime = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO import_batch (
        id, name, upload_time, uploader, status,
        total_rows, valid_rows, error_rows, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      batch.name,
      uploadTime,
      batch.uploader,
      batch.status,
      batch.totalRows,
      batch.validRows,
      batch.errorRows,
      batch.version
    );
    
    return { ...batch, id, uploadTime };
  }

  updateImportBatchStatus(batchId: string, status: ImportBatch['status'], validRows?: number, errorRows?: number): boolean {
    const db = getDb();
    let sql = 'UPDATE import_batch SET status = ?';
    const params: any[] = [status];
    
    if (validRows !== undefined) {
      sql += ', valid_rows = ?';
      params.push(validRows);
    }
    if (errorRows !== undefined) {
      sql += ', error_rows = ?';
      params.push(errorRows);
    }
    
    sql += ' WHERE id = ?';
    params.push(batchId);
    
    const info = db.prepare(sql).run(...params);
    return info.changes > 0;
  }

  getImportBatch(batchId: string): ImportBatch | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM import_batch WHERE id = ?').get(batchId) as any;
    return row ? this.mapToImportBatch(row) : null;
  }

  listImportBatches(limit = 50): ImportBatch[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM import_batch ORDER BY upload_time DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => this.mapToImportBatch(row));
  }

  createImportWarning(warning: Omit<DataImportWarning, 'id'>): DataImportWarning {
    const db = getDb();
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO data_import_warning (
        id, batch_id, source_file, row_number, object_id,
        object_name, warning_type, severity, message,
        suggestion, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      warning.batchId,
      warning.sourceFile,
      warning.rowNumber,
      warning.objectId || null,
      warning.objectName || null,
      warning.warningType,
      warning.severity,
      warning.message,
      warning.suggestion || '',
      JSON.stringify(warning.rawData || {})
    );
    
    return { ...warning, id };
  }

  bulkCreateImportWarnings(warnings: Omit<DataImportWarning, 'id'>[]): DataImportWarning[] {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO data_import_warning (
        id, batch_id, source_file, row_number, object_id,
        object_name, warning_type, severity, message,
        suggestion, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result: DataImportWarning[] = [];
    
    const insertMany = db.transaction((items) => {
      for (const w of items) {
        const id = uuidv4();
        stmt.run(
          id,
          w.batchId,
          w.sourceFile,
          w.rowNumber,
          w.objectId || null,
          w.objectName || null,
          w.warningType,
          w.severity,
          w.message,
          w.suggestion || '',
          JSON.stringify(w.rawData || {})
        );
        result.push({ ...w, id });
      }
    });
    
    insertMany(warnings);
    return result;
  }

  getWarningsByBatch(batchId: string): DataImportWarning[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM data_import_warning WHERE batch_id = ? ORDER BY severity DESC, row_number').all(batchId) as any[];
    return rows.map(row => this.mapToWarning(row));
  }

  getRecentWarnings(limit = 20): DataImportWarning[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT w.* FROM data_import_warning w
      JOIN import_batch b ON w.batch_id = b.id
      ORDER BY b.upload_time DESC, w.severity DESC
      LIMIT ?
    `).all(limit) as any[];
    return rows.map(row => this.mapToWarning(row));
  }

  createBatchTask(task: Omit<BatchTask, 'id'>): BatchTask {
    const db = getDb();
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO batch_task (
        id, type, status, total_count, success_count,
        failed_count, progress, started_at, completed_at,
        failed_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      task.type,
      task.status,
      task.totalCount,
      task.successCount,
      task.failedCount,
      task.progress,
      task.startedAt || null,
      task.completedAt || null,
      JSON.stringify(task.failedItems || [])
    );
    
    return { ...task, id };
  }

  updateBatchTaskProgress(taskId: string, progress: number, successCount?: number, failedCount?: number, failedItems?: FailedItem[]): boolean {
    const db = getDb();
    let sql = 'UPDATE batch_task SET progress = ?';
    const params: any[] = [progress];
    
    if (successCount !== undefined) {
      sql += ', success_count = ?';
      params.push(successCount);
    }
    if (failedCount !== undefined) {
      sql += ', failed_count = ?';
      params.push(failedCount);
    }
    if (failedItems !== undefined) {
      sql += ', failed_items = ?';
      params.push(JSON.stringify(failedItems));
    }
    
    sql += ' WHERE id = ?';
    params.push(taskId);
    
    const info = db.prepare(sql).run(...params);
    return info.changes > 0;
  }

  completeBatchTask(taskId: string, status: BatchTask['status'], failedItems?: FailedItem[]): boolean {
    const db = getDb();
    const completedAt = new Date().toISOString();
    
    let sql = 'UPDATE batch_task SET status = ?, completed_at = ?';
    const params: any[] = [status, completedAt];
    
    if (failedItems !== undefined) {
      sql += ', failed_items = ?';
      params.push(JSON.stringify(failedItems));
    }
    
    sql += ' WHERE id = ?';
    params.push(taskId);
    
    const info = db.prepare(sql).run(...params);
    return info.changes > 0;
  }

  getBatchTask(taskId: string): BatchTask | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM batch_task WHERE id = ?').get(taskId) as any;
    return row ? this.mapToBatchTask(row) : null;
  }

  private mapToCreditLine(row: any): CreditLine {
    return {
      id: row.id,
      customerId: row.customer_id,
      totalAmount: row.total_amount,
      usedAmount: row.used_amount,
      availableAmount: row.available_amount,
      asOfDate: row.as_of_date,
      currency: row.currency,
      attributes: row.attributes ? JSON.parse(row.attributes) : {},
      version: row.version,
      sourceFile: row.source_file,
      sourceRow: row.source_row,
      sourceBatch: row.source_batch,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToImportBatch(row: any): ImportBatch {
    return {
      id: row.id,
      name: row.name,
      uploadTime: row.upload_time,
      uploader: row.uploader,
      status: row.status,
      totalRows: row.total_rows,
      validRows: row.valid_rows,
      errorRows: row.error_rows,
      version: row.version
    };
  }

  private mapToWarning(row: any): DataImportWarning {
    return {
      id: row.id,
      batchId: row.batch_id,
      sourceFile: row.source_file,
      rowNumber: row.row_number,
      objectId: row.object_id,
      objectName: row.object_name,
      warningType: row.warning_type,
      severity: row.severity as 'info' | 'warning' | 'error',
      message: row.message,
      suggestion: row.suggestion,
      rawData: row.raw_data ? JSON.parse(row.raw_data) : {}
    };
  }

  private mapToBatchTask(row: any): BatchTask {
    return {
      id: row.id,
      type: row.type as BatchTask['type'],
      status: row.status as BatchTask['status'],
      totalCount: row.total_count,
      successCount: row.success_count,
      failedCount: row.failed_count,
      progress: row.progress,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      failedItems: row.failed_items ? JSON.parse(row.failed_items) : []
    };
  }
}

export const creditRepository = new CreditRepository();
