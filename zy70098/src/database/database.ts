import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import {
  InvitationBatch, Enrollment, ExecutionRecord, SettlementResult, EventRecord
} from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class DatabaseService {
  private db: SqlJsDatabase;
  private dbPath: string;

  private constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
    this.initializeTables();
  }

  static async create(dbPath: string = ':memory:'): Promise<DatabaseService> {
    const SQL = await initSqlJs();

    let db: SqlJsDatabase;
    if (dbPath === ':memory:') {
      db = new SQL.Database();
    } else {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
      } else {
        db = new SQL.Database();
      }
    }

    return new DatabaseService(db, dbPath);
  }

  private initializeTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS invitation_batches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        target_peak_load REAL NOT NULL,
        unit_price REAL NOT NULL,
        enrollment_start_time TEXT NOT NULL,
        enrollment_end_time TEXT NOT NULL,
        execution_start_time TEXT NOT NULL,
        execution_end_time TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        enterprise_id TEXT NOT NULL,
        enterprise_name TEXT NOT NULL,
        declared_capacity REAL NOT NULL,
        minimum_guaranteed_capacity REAL,
        contact_name TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        status TEXT NOT NULL,
        review_comment TEXT,
        submitted_at TEXT NOT NULL,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS execution_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        enrollment_id TEXT NOT NULL,
        enterprise_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        baseline_load REAL NOT NULL,
        actual_load REAL NOT NULL,
        source_system TEXT NOT NULL,
        created_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS settlement_results (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        enrollment_id TEXT NOT NULL,
        enterprise_id TEXT NOT NULL,
        settlement_amount REAL NOT NULL,
        deviation_rate REAL NOT NULL,
        reduction_amount REAL NOT NULL,
        status TEXT NOT NULL,
        settlement_time TEXT,
        failure_reason TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS event_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        enrollment_id TEXT,
        entity_type TEXT NOT NULL,
        event_type TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        operator TEXT,
        notes TEXT
      )
    `);

    this.persist();
  }

  private persist(): void {
    if (this.dbPath !== ':memory:') {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }
  }

  saveBatch(batch: InvitationBatch, expectedVersion?: number): InvitationBatch {
    const now = new Date().toISOString();

    if (expectedVersion !== undefined) {
      const result = this.db.exec(
        'SELECT version FROM invitation_batches WHERE id = ?',
        [batch.id]
      );

      if (result.length > 0 && result[0].values.length > 0) {
        const currentVersion = result[0].values[0][0] as number;
        if (currentVersion !== expectedVersion) {
          throw new Error(`乐观锁冲突：预期版本 ${expectedVersion}，实际版本 ${currentVersion}`);
        }
      }
    }

    const existingResult = this.db.exec(
      'SELECT id FROM invitation_batches WHERE id = ?',
      [batch.id]
    );
    const existing = existingResult.length > 0 && existingResult[0].values.length > 0;

    if (existing) {
      this.db.run(`
        UPDATE invitation_batches SET
          name = ?, description = ?, target_peak_load = ?, unit_price = ?,
          enrollment_start_time = ?, enrollment_end_time = ?, execution_start_time = ?,
          execution_end_time = ?, status = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `, [
        batch.name, batch.description, batch.targetPeakLoad, batch.unitPrice,
        batch.enrollmentStartTime.toISOString(), batch.enrollmentEndTime.toISOString(),
        batch.executionStartTime.toISOString(), batch.executionEndTime.toISOString(),
        batch.status, now, batch.id
      ]);
    } else {
      this.db.run(`
        INSERT INTO invitation_batches (
          id, name, description, target_peak_load, unit_price,
          enrollment_start_time, enrollment_end_time, execution_start_time,
          execution_end_time, status, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        batch.id, batch.name, batch.description, batch.targetPeakLoad, batch.unitPrice,
        batch.enrollmentStartTime.toISOString(), batch.enrollmentEndTime.toISOString(),
        batch.executionStartTime.toISOString(), batch.executionEndTime.toISOString(),
        batch.status, batch.createdAt.toISOString(), now, batch.version
      ]);
    }

    this.persist();
    const saved = this.getBatch(batch.id);
    if (!saved) {
      throw new Error('保存批次失败');
    }
    return saved;
  }

  getBatch(id: string): InvitationBatch | undefined {
    const result = this.db.exec(
      'SELECT * FROM invitation_batches WHERE id = ?',
      [id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    return this.mapResultToBatch(result[0]);
  }

  getAllBatches(): InvitationBatch[] {
    const result = this.db.exec('SELECT * FROM invitation_batches');
    if (result.length === 0) return [];
    return this.mapResultsToBatches(result[0]);
  }

  saveEnrollment(enrollment: Enrollment, expectedVersion?: number): Enrollment {
    const now = new Date().toISOString();

    if (expectedVersion !== undefined) {
      const result = this.db.exec(
        'SELECT version FROM enrollments WHERE id = ?',
        [enrollment.id]
      );

      if (result.length > 0 && result[0].values.length > 0) {
        const currentVersion = result[0].values[0][0] as number;
        if (currentVersion !== expectedVersion) {
          throw new Error(`乐观锁冲突：预期版本 ${expectedVersion}，实际版本 ${currentVersion}`);
        }
      }
    }

    const existingResult = this.db.exec(
      'SELECT id FROM enrollments WHERE id = ?',
      [enrollment.id]
    );
    const existing = existingResult.length > 0 && existingResult[0].values.length > 0;

    if (existing) {
      this.db.run(`
        UPDATE enrollments SET
          enterprise_id = ?, enterprise_name = ?, declared_capacity = ?,
          minimum_guaranteed_capacity = ?, contact_name = ?, contact_phone = ?,
          status = ?, review_comment = ?, reviewed_at = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `, [
        enrollment.enterpriseId, enrollment.enterpriseName, enrollment.declaredCapacity,
        enrollment.minimumGuaranteedCapacity || null, enrollment.contactName, enrollment.contactPhone,
        enrollment.status, enrollment.reviewComment || null,
        enrollment.reviewedAt?.toISOString() || null, now, enrollment.id
      ]);
    } else {
      this.db.run(`
        INSERT INTO enrollments (
          id, batch_id, enterprise_id, enterprise_name, declared_capacity,
          minimum_guaranteed_capacity, contact_name, contact_phone, status,
          review_comment, submitted_at, reviewed_at, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        enrollment.id, enrollment.batchId, enrollment.enterpriseId, enrollment.enterpriseName,
        enrollment.declaredCapacity, enrollment.minimumGuaranteedCapacity || null,
        enrollment.contactName, enrollment.contactPhone, enrollment.status,
        enrollment.reviewComment || null, enrollment.submittedAt.toISOString(),
        enrollment.reviewedAt?.toISOString() || null, enrollment.createdAt.toISOString(),
        now, enrollment.version
      ]);
    }

    this.persist();
    const saved = this.getEnrollment(enrollment.id);
    if (!saved) {
      throw new Error('保存报名记录失败');
    }
    return saved;
  }

  getEnrollment(id: string): Enrollment | undefined {
    const result = this.db.exec(
      'SELECT * FROM enrollments WHERE id = ?',
      [id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    return this.mapResultToEnrollment(result[0]);
  }

  getEnrollmentsByBatch(batchId: string): Enrollment[] {
    const result = this.db.exec(
      'SELECT * FROM enrollments WHERE batch_id = ?',
      [batchId]
    );
    if (result.length === 0) return [];
    return this.mapResultsToEnrollments(result[0]);
  }

  getEnrollmentByBatchAndEnterprise(batchId: string, enterpriseId: string): Enrollment | undefined {
    const result = this.db.exec(
      'SELECT * FROM enrollments WHERE batch_id = ? AND enterprise_id = ?',
      [batchId, enterpriseId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    return this.mapResultToEnrollment(result[0]);
  }

  saveExecutionRecord(record: ExecutionRecord): ExecutionRecord {
    const now = new Date().toISOString();

    this.db.run(`
      INSERT INTO execution_records (
        id, batch_id, enrollment_id, enterprise_id, timestamp,
        baseline_load, actual_load, source_system, created_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.id, record.batchId, record.enrollmentId, record.enterpriseId,
      record.timestamp.toISOString(), record.baselineLoad, record.actualLoad,
      record.sourceSystem, now, record.version
    ]);

    this.persist();
    return record;
  }

  getExecutionRecordsByEnrollment(enrollmentId: string): ExecutionRecord[] {
    const result = this.db.exec(
      'SELECT * FROM execution_records WHERE enrollment_id = ? ORDER BY timestamp',
      [enrollmentId]
    );
    if (result.length === 0) return [];
    return this.mapResultsToExecutionRecords(result[0]);
  }

  getExecutionRecordsByBatch(batchId: string): ExecutionRecord[] {
    const result = this.db.exec(
      'SELECT * FROM execution_records WHERE batch_id = ? ORDER BY timestamp',
      [batchId]
    );
    if (result.length === 0) return [];
    return this.mapResultsToExecutionRecords(result[0]);
  }

  saveSettlementResult(result: SettlementResult, expectedVersion?: number): SettlementResult {
    const now = new Date().toISOString();

    if (expectedVersion !== undefined) {
      const dbResult = this.db.exec(
        'SELECT version FROM settlement_results WHERE id = ?',
        [result.id]
      );

      if (dbResult.length > 0 && dbResult[0].values.length > 0) {
        const currentVersion = dbResult[0].values[0][0] as number;
        if (currentVersion !== expectedVersion) {
          throw new Error(`乐观锁冲突：预期版本 ${expectedVersion}，实际版本 ${currentVersion}`);
        }
      }
    }

    const existingResult = this.db.exec(
      'SELECT id FROM settlement_results WHERE id = ?',
      [result.id]
    );
    const existing = existingResult.length > 0 && existingResult[0].values.length > 0;

    if (existing) {
      this.db.run(`
        UPDATE settlement_results SET
          settlement_amount = ?, deviation_rate = ?, reduction_amount = ?,
          status = ?, settlement_time = ?, failure_reason = ?, retry_count = ?,
          updated_at = ?, version = version + 1
        WHERE id = ?
      `, [
        result.settlementAmount, result.deviationRate, result.reductionAmount,
        result.status, result.settlementTime?.toISOString() || null, result.failureReason || null,
        result.retryCount, now, result.id
      ]);
    } else {
      this.db.run(`
        INSERT INTO settlement_results (
          id, batch_id, enrollment_id, enterprise_id, settlement_amount,
          deviation_rate, reduction_amount, status, settlement_time,
          failure_reason, retry_count, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        result.id, result.batchId, result.enrollmentId, result.enterpriseId,
        result.settlementAmount, result.deviationRate, result.reductionAmount,
        result.status, result.settlementTime?.toISOString() || null, result.failureReason || null,
        result.retryCount, result.createdAt.toISOString(), now, result.version
      ]);
    }

    this.persist();
    const saved = this.db.exec(
      'SELECT * FROM settlement_results WHERE id = ?',
      [result.id]
    );
    if (saved.length === 0 || saved[0].values.length === 0) {
      throw new Error('保存结算结果失败');
    }
    return this.mapResultToSettlementResult(saved[0]);
  }

  getSettlementResult(enrollmentId: string): SettlementResult | undefined {
    const result = this.db.exec(
      'SELECT * FROM settlement_results WHERE enrollment_id = ?',
      [enrollmentId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    return this.mapResultToSettlementResult(result[0]);
  }

  getSettlementResultsByBatch(batchId: string): SettlementResult[] {
    const result = this.db.exec(
      'SELECT * FROM settlement_results WHERE batch_id = ?',
      [batchId]
    );
    if (result.length === 0) return [];
    return this.mapResultsToSettlementResults(result[0]);
  }

  saveEvent(event: EventRecord): void {
    this.db.run(`
      INSERT INTO event_records (
        id, batch_id, enrollment_id, entity_type, event_type,
        from_status, to_status, payload, timestamp, operator, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      event.id, event.batchId || null, event.enrollmentId || null, event.entityType, event.eventType,
      event.fromStatus || null, event.toStatus || null, JSON.stringify(event.payload),
      event.timestamp.toISOString(), event.operator || null, event.notes || null
    ]);
    this.persist();
  }

  getEventsByBatch(batchId: string): EventRecord[] {
    const result = this.db.exec(
      'SELECT * FROM event_records WHERE batch_id = ? ORDER BY timestamp',
      [batchId]
    );
    if (result.length === 0) return [];
    return this.mapResultsToEventRecords(result[0]);
  }

  getEventsByEnrollment(enrollmentId: string): EventRecord[] {
    const result = this.db.exec(
      'SELECT * FROM event_records WHERE enrollment_id = ? ORDER BY timestamp',
      [enrollmentId]
    );
    if (result.length === 0) return [];
    return this.mapResultsToEventRecords(result[0]);
  }

  private mapResultToBatch(result: { columns: string[]; values: any[][] }): InvitationBatch {
    const row = this.rowToObject(result);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      targetPeakLoad: row.target_peak_load,
      unitPrice: row.unit_price,
      enrollmentStartTime: new Date(row.enrollment_start_time),
      enrollmentEndTime: new Date(row.enrollment_end_time),
      executionStartTime: new Date(row.execution_start_time),
      executionEndTime: new Date(row.execution_end_time),
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version
    };
  }

  private mapResultsToBatches(result: { columns: string[]; values: any[][] }): InvitationBatch[] {
    return result.values.map((_, index) => {
      const singleRowResult = {
        columns: result.columns,
        values: [result.values[index]]
      };
      return this.mapResultToBatch(singleRowResult);
    });
  }

  private mapResultToEnrollment(result: { columns: string[]; values: any[][] }): Enrollment {
    const row = this.rowToObject(result);
    return {
      id: row.id,
      batchId: row.batch_id,
      enterpriseId: row.enterprise_id,
      enterpriseName: row.enterprise_name,
      declaredCapacity: row.declared_capacity,
      minimumGuaranteedCapacity: row.minimum_guaranteed_capacity,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      status: row.status,
      reviewComment: row.review_comment,
      submittedAt: new Date(row.submitted_at),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version
    };
  }

  private mapResultsToEnrollments(result: { columns: string[]; values: any[][] }): Enrollment[] {
    return result.values.map((_, index) => {
      const singleRowResult = {
        columns: result.columns,
        values: [result.values[index]]
      };
      return this.mapResultToEnrollment(singleRowResult);
    });
  }

  private mapResultToExecutionRecord(result: { columns: string[]; values: any[][] }): ExecutionRecord {
    const row = this.rowToObject(result);
    return {
      id: row.id,
      batchId: row.batch_id,
      enrollmentId: row.enrollment_id,
      enterpriseId: row.enterprise_id,
      timestamp: new Date(row.timestamp),
      baselineLoad: row.baseline_load,
      actualLoad: row.actual_load,
      sourceSystem: row.source_system,
      createdAt: new Date(row.created_at),
      version: row.version
    };
  }

  private mapResultsToExecutionRecords(result: { columns: string[]; values: any[][] }): ExecutionRecord[] {
    return result.values.map((_, index) => {
      const singleRowResult = {
        columns: result.columns,
        values: [result.values[index]]
      };
      return this.mapResultToExecutionRecord(singleRowResult);
    });
  }

  private mapResultToSettlementResult(result: { columns: string[]; values: any[][] }): SettlementResult {
    const row = this.rowToObject(result);
    return {
      id: row.id,
      batchId: row.batch_id,
      enrollmentId: row.enrollment_id,
      enterpriseId: row.enterprise_id,
      settlementAmount: row.settlement_amount,
      deviationRate: row.deviation_rate,
      reductionAmount: row.reduction_amount,
      status: row.status,
      settlementTime: row.settlement_time ? new Date(row.settlement_time) : undefined,
      failureReason: row.failure_reason,
      retryCount: row.retry_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      version: row.version
    };
  }

  private mapResultsToSettlementResults(result: { columns: string[]; values: any[][] }): SettlementResult[] {
    return result.values.map((_, index) => {
      const singleRowResult = {
        columns: result.columns,
        values: [result.values[index]]
      };
      return this.mapResultToSettlementResult(singleRowResult);
    });
  }

  private mapResultToEventRecord(result: { columns: string[]; values: any[][] }): EventRecord {
    const row = this.rowToObject(result);
    return {
      id: row.id,
      batchId: row.batch_id,
      enrollmentId: row.enrollment_id,
      entityType: row.entity_type,
      eventType: row.event_type,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      payload: JSON.parse(row.payload),
      timestamp: new Date(row.timestamp),
      operator: row.operator,
      notes: row.notes
    };
  }

  private mapResultsToEventRecords(result: { columns: string[]; values: any[][] }): EventRecord[] {
    return result.values.map((_, index) => {
      const singleRowResult = {
        columns: result.columns,
        values: [result.values[index]]
      };
      return this.mapResultToEventRecord(singleRowResult);
    });
  }

  private rowToObject(result: { columns: string[]; values: any[][] }): Record<string, any> {
    const obj: Record<string, any> = {};
    const row = result.values[0];
    result.columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  }

  close(): void {
    this.persist();
    this.db.close();
  }
}
