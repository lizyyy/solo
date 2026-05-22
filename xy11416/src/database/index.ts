import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import {
  RawRecord,
  StandardizedRecord,
  FactRecord,
  ValidationError,
  SourceType,
  RecordStatus,
  ImportSession,
} from '../types';

export class DatabaseManager {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(workDir: string) {
    this.dbPath = path.join(workDir, 'pmi.db');
    this.db = new sqlite3.Database(this.dbPath);
    this.db.serialize(() => {
      this.db.run('PRAGMA journal_mode = WAL');
      this.db.run('PRAGMA foreign_keys = ON');
    });
  }

  initSchema(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        const statements = [
          `CREATE TABLE IF NOT EXISTS raw_records (
            id TEXT PRIMARY KEY,
            source_file TEXT NOT NULL,
            source_type TEXT NOT NULL,
            raw_line_number INTEGER NOT NULL,
            raw_content TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            import_batch_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            is_deleted INTEGER NOT NULL DEFAULT 0,
            UNIQUE(source_file, raw_line_number, import_batch_id)
          )`,
          `CREATE TABLE IF NOT EXISTS standardized_records (
            id TEXT PRIMARY KEY,
            raw_record_id TEXT NOT NULL,
            fact_id TEXT NOT NULL,
            order_number TEXT,
            resident_name TEXT,
            room_number TEXT,
            phone_number TEXT,
            repair_type TEXT,
            description TEXT,
            report_time TEXT,
            technician_name TEXT,
            arrival_time TEXT,
            completion_time TEXT,
            repair_result TEXT,
            material_name TEXT,
            material_quantity REAL,
            material_unit TEXT,
            supervisor_note TEXT,
            standardized_at TEXT NOT NULL,
            standardized_by TEXT NOT NULL,
            is_manual_override INTEGER NOT NULL DEFAULT 0,
            confidence REAL NOT NULL DEFAULT 1.0
          )`,
          `CREATE TABLE IF NOT EXISTS fact_records (
            id TEXT PRIMARY KEY,
            order_number TEXT UNIQUE NOT NULL,
            current_status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            is_frozen INTEGER NOT NULL DEFAULT 0,
            frozen_at TEXT,
            frozen_by TEXT
          )`,
          `CREATE TABLE IF NOT EXISTS validation_errors (
            id TEXT PRIMARY KEY,
            record_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            error_code TEXT NOT NULL,
            error_message TEXT NOT NULL,
            severity TEXT NOT NULL,
            created_at TEXT NOT NULL,
            resolved INTEGER NOT NULL DEFAULT 0,
            resolved_at TEXT,
            resolved_by TEXT,
            resolution TEXT
          )`,
          `CREATE TABLE IF NOT EXISTS import_sessions (
            batch_id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            source_file TEXT NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT,
            status TEXT NOT NULL,
            total_records INTEGER NOT NULL DEFAULT 0,
            processed_records INTEGER NOT NULL DEFAULT 0
          )`,
          `CREATE TABLE IF NOT EXISTS change_logs (
            id TEXT PRIMARY KEY,
            fact_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_at TEXT NOT NULL,
            changed_by TEXT NOT NULL,
            change_reason TEXT
          )`,
          `CREATE INDEX IF NOT EXISTS idx_raw_batch ON raw_records(import_batch_id)`,
          `CREATE INDEX IF NOT EXISTS idx_std_fact ON standardized_records(fact_id)`,
          `CREATE INDEX IF NOT EXISTS idx_std_raw ON standardized_records(raw_record_id)`,
          `CREATE INDEX IF NOT EXISTS idx_err_record ON validation_errors(record_id)`,
          `CREATE INDEX IF NOT EXISTS idx_fact_order ON fact_records(order_number)`,
        ];

        let completed = 0;
        let errorOccurred: Error | null = null;

        for (const stmt of statements) {
          this.db.run(stmt, (err) => {
            completed++;
            if (err && !errorOccurred) {
              errorOccurred = err;
            }
            if (completed === statements.length) {
              if (errorOccurred) {
                reject(errorOccurred);
              } else {
                resolve();
              }
            }
          });
        }
      });
    });
  }

  run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve((row as T) || null);
      });
    });
  }

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async createImportSession(session: Omit<ImportSession, 'startedAt' | 'status' | 'processedRecords'>): Promise<ImportSession> {
    const now = moment().toISOString();
    await this.run(
      `INSERT INTO import_sessions (batch_id, source_type, source_file, started_at, status, total_records, processed_records)
       VALUES (?, ?, ?, ?, 'running', ?, 0)`,
      [session.batchId, session.sourceType, session.sourceFile, now, session.totalRecords]
    );
    return {
      ...session,
      startedAt: now,
      status: 'running',
      processedRecords: 0,
    };
  }

  async updateImportSession(batchId: string, processed: number, status: 'running' | 'completed' | 'failed'): Promise<void> {
    const now = moment().toISOString();
    await this.run(
      `UPDATE import_sessions SET processed_records = ?, status = ?, completed_at = ? WHERE batch_id = ?`,
      [processed, status, now, batchId]
    );
  }

  async insertRawRecord(record: Omit<RawRecord, 'id' | 'importedAt' | 'isDeleted'>): Promise<RawRecord> {
    const id = uuidv4();
    const now = moment().toISOString();
    await this.run(
      `INSERT INTO raw_records (id, source_file, source_type, raw_line_number, raw_content, imported_at, import_batch_id, status, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, record.sourceFile, record.sourceType, record.rawLineNumber, record.rawContent, now, record.importBatchId, record.status]
    );
    return {
      ...record,
      id,
      importedAt: now,
      isDeleted: false,
    };
  }

  async findRawRecordByFingerprint(sourceFile: string, rawLineNumber: number, batchId: string): Promise<RawRecord | null> {
    const row = await this.get(
      `SELECT * FROM raw_records WHERE source_file = ? AND raw_line_number = ? AND import_batch_id = ? AND is_deleted = 0`,
      [sourceFile, rawLineNumber, batchId]
    );
    return row ? this.mapRawRecord(row) : null;
  }

  async findFactByOrderNumber(orderNumber: string): Promise<FactRecord | null> {
    const row = await this.get(`SELECT * FROM fact_records WHERE order_number = ?`, [orderNumber]);
    return row ? this.mapFactRecord(row) : null;
  }

  async createFactRecord(orderNumber: string, status: string): Promise<FactRecord> {
    const id = uuidv4();
    const now = moment().toISOString();
    await this.run(
      `INSERT INTO fact_records (id, order_number, current_status, created_at, updated_at, version, is_frozen)
       VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [id, orderNumber, status, now, now]
    );
    return {
      id,
      orderNumber,
      currentStatus: status,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isFrozen: false,
    };
  }

  async updateFactRecord(factId: string, updates: Partial<FactRecord>): Promise<void> {
    const now = moment().toISOString();
    const setClauses: string[] = ['updated_at = ?', 'version = version + 1'];
    const values: any[] = [now];

    if (updates.currentStatus !== undefined) {
      setClauses.push('current_status = ?');
      values.push(updates.currentStatus);
    }
    if (updates.isFrozen !== undefined) {
      setClauses.push('is_frozen = ?');
      values.push(updates.isFrozen ? 1 : 0);
      if (updates.isFrozen) {
        setClauses.push('frozen_at = ?');
        setClauses.push('frozen_by = ?');
        values.push(now);
        values.push(updates.frozenBy || 'system');
      }
    }

    values.push(factId);
    await this.run(`UPDATE fact_records SET ${setClauses.join(', ')} WHERE id = ?`, values);
  }

  async insertStandardizedRecord(record: Omit<StandardizedRecord, 'id'>): Promise<StandardizedRecord> {
    const id = uuidv4();
    await this.run(
      `INSERT INTO standardized_records (
        id, raw_record_id, fact_id, order_number, resident_name, room_number,
        phone_number, repair_type, description, report_time, technician_name,
        arrival_time, completion_time, repair_result, material_name,
        material_quantity, material_unit, supervisor_note,
        standardized_at, standardized_by, is_manual_override, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        record.rawRecordId,
        record.factId,
        record.orderNumber,
        record.residentName,
        record.roomNumber,
        record.phoneNumber,
        record.repairType,
        record.description,
        record.reportTime,
        record.technicianName,
        record.arrivalTime,
        record.completionTime,
        record.repairResult,
        record.materialName,
        record.materialQuantity,
        record.materialUnit,
        record.supervisorNote,
        record.standardizedAt,
        record.standardizedBy,
        record.isManualOverride ? 1 : 0,
        record.confidence,
      ]
    );
    return { ...record, id };
  }

  async insertValidationError(error: Omit<ValidationError, 'id' | 'createdAt' | 'resolved'>): Promise<ValidationError> {
    const id = uuidv4();
    const now = moment().toISOString();
    await this.run(
      `INSERT INTO validation_errors (
        id, record_id, field_name, error_code, error_message,
        severity, created_at, resolved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, error.recordId, error.fieldName, error.errorCode, error.errorMessage, error.severity, now]
    );
    return {
      ...error,
      id,
      createdAt: now,
      resolved: false,
    };
  }

  async resolveValidationError(errorId: string, resolvedBy: string, resolution: string): Promise<void> {
    const now = moment().toISOString();
    await this.run(
      `UPDATE validation_errors SET resolved = 1, resolved_at = ?, resolved_by = ?, resolution = ? WHERE id = ?`,
      [now, resolvedBy, resolution, errorId]
    );
  }

  async getUnresolvedErrors(recordId?: string): Promise<ValidationError[]> {
    let query = 'SELECT * FROM validation_errors WHERE resolved = 0';
    const params: any[] = [];
    if (recordId) {
      query += ' AND record_id = ?';
      params.push(recordId);
    }
    const rows = await this.all(query, params);
    return rows.map(row => this.mapValidationError(row));
  }

  async getFailedRecords(batchId?: string): Promise<(RawRecord & { errors: string[] })[]> {
    let query = `
      SELECT r.*, GROUP_CONCAT(e.error_message, '|') as error_messages
      FROM raw_records r
      LEFT JOIN validation_errors e ON r.id = e.record_id
      WHERE r.status = 'failed' AND r.is_deleted = 0
    `;
    const params: any[] = [];
    if (batchId) {
      query += ' AND r.import_batch_id = ?';
      params.push(batchId);
    }
    query += ' GROUP BY r.id';
    const rows = await this.all(query, params);
    return rows.map(row => ({
      ...this.mapRawRecord(row),
      errors: row.error_messages ? row.error_messages.split('|') : [],
    }));
  }

  async getImportHistory(limit: number = 50): Promise<ImportSession[]> {
    const rows = await this.all(
      `SELECT * FROM import_sessions ORDER BY started_at DESC LIMIT ?`,
      [limit]
    );
    return rows.map(row => this.mapImportSession(row));
  }

  async getSessionById(batchId: string): Promise<ImportSession | null> {
    const row = await this.get(`SELECT * FROM import_sessions WHERE batch_id = ?`, [batchId]);
    return row ? this.mapImportSession(row) : null;
  }

  async getRawRecordsByBatch(batchId: string): Promise<RawRecord[]> {
    const rows = await this.all(
      `SELECT * FROM raw_records WHERE import_batch_id = ? AND is_deleted = 0`,
      [batchId]
    );
    return rows.map(row => this.mapRawRecord(row));
  }

  async getStandardizedRecordsByFact(factId: string): Promise<StandardizedRecord[]> {
    let query = 'SELECT * FROM standardized_records';
    const params: any[] = [];
    if (factId) {
      query += ' WHERE fact_id = ?';
      params.push(factId);
    }
    const rows = await this.all(query, params);
    return rows.map(row => this.mapStandardizedRecord(row));
  }

  async getFactRecords(includeFrozen: boolean = true): Promise<FactRecord[]> {
    let query = 'SELECT * FROM fact_records';
    if (!includeFrozen) {
      query += ' WHERE is_frozen = 0';
    }
    query += ' ORDER BY updated_at DESC';
    const rows = await this.all(query);
    return rows.map(row => this.mapFactRecord(row));
  }

  async updateRawRecordStatus(id: string, status: RecordStatus): Promise<void> {
    await this.run(`UPDATE raw_records SET status = ? WHERE id = ?`, [status, id]);
  }

  async logChange(factId: string, fieldName: string, oldValue: string | undefined, newValue: string | undefined, changedBy: string, reason: string): Promise<void> {
    const id = uuidv4();
    const now = moment().toISOString();
    await this.run(
      `INSERT INTO change_logs (id, fact_id, field_name, old_value, new_value, changed_at, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, factId, fieldName, oldValue, newValue, now, changedBy, reason]
    );
  }

  private mapRawRecord(row: any): RawRecord {
    return {
      id: row.id,
      sourceFile: row.source_file,
      sourceType: row.source_type as SourceType,
      rawLineNumber: row.raw_line_number,
      rawContent: row.raw_content,
      importedAt: row.imported_at,
      importBatchId: row.import_batch_id,
      status: row.status as RecordStatus,
      isDeleted: row.is_deleted === 1,
    };
  }

  private mapStandardizedRecord(row: any): StandardizedRecord {
    return {
      id: row.id,
      rawRecordId: row.raw_record_id,
      factId: row.fact_id,
      orderNumber: row.order_number,
      residentName: row.resident_name,
      roomNumber: row.room_number,
      phoneNumber: row.phone_number,
      repairType: row.repair_type,
      description: row.description,
      reportTime: row.report_time,
      technicianName: row.technician_name,
      arrivalTime: row.arrival_time,
      completionTime: row.completion_time,
      repairResult: row.repair_result,
      materialName: row.material_name,
      materialQuantity: row.material_quantity,
      materialUnit: row.material_unit,
      supervisorNote: row.supervisor_note,
      standardizedAt: row.standardized_at,
      standardizedBy: row.standardized_by,
      isManualOverride: row.is_manual_override === 1,
      confidence: row.confidence,
    };
  }

  private mapFactRecord(row: any): FactRecord {
    return {
      id: row.id,
      orderNumber: row.order_number,
      currentStatus: row.current_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      isFrozen: row.is_frozen === 1,
      frozenAt: row.frozen_at,
      frozenBy: row.frozen_by,
    };
  }

  private mapValidationError(row: any): ValidationError {
    return {
      id: row.id,
      recordId: row.record_id,
      fieldName: row.field_name,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      severity: row.severity as 'error' | 'warning',
      createdAt: row.created_at,
      resolved: row.resolved === 1,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      resolution: row.resolution,
    };
  }

  private mapImportSession(row: any): ImportSession {
    return {
      batchId: row.batch_id,
      sourceType: row.source_type as SourceType,
      sourceFile: row.source_file,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status as 'running' | 'completed' | 'failed',
      totalRecords: row.total_records,
      processedRecords: row.processed_records,
    };
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

let dbManager: DatabaseManager | null = null;

export function getDatabase(workDir: string): DatabaseManager {
  if (!dbManager) {
    dbManager = new DatabaseManager(workDir);
  }
  return dbManager;
}
