import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  FilingRecord,
  FilingStatus,
  ApprovalStatus,
  ExceptionTrace,
  AccessLog,
  StatusHistory,
  CreateFilingRequest,
  HandleExceptionRequest
} from '../types';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './filing.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private initTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS filing_records (
            id TEXT PRIMARY KEY,
            serviceName TEXT NOT NULL,
            egressAddress TEXT NOT NULL,
            openWindow TEXT NOT NULL,
            purpose TEXT NOT NULL,
            closeCondition TEXT NOT NULL,
            status TEXT NOT NULL,
            approvalStatus TEXT NOT NULL,
            approver TEXT,
            approvedAt TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            creator TEXT NOT NULL,
            closedAt TEXT,
            closer TEXT,
            closeReason TEXT
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS status_history (
            id TEXT PRIMARY KEY,
            filingId TEXT NOT NULL,
            fromStatus TEXT,
            toStatus TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            operator TEXT,
            reason TEXT NOT NULL,
            FOREIGN KEY (filingId) REFERENCES filing_records(id)
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS exception_traces (
            id TEXT PRIMARY KEY,
            filingId TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            step TEXT NOT NULL,
            originalInput TEXT NOT NULL,
            processingBasis TEXT NOT NULL,
            conclusion TEXT NOT NULL,
            errorCode TEXT,
            errorMessage TEXT,
            operator TEXT,
            FOREIGN KEY (filingId) REFERENCES filing_records(id)
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS access_logs (
            id TEXT PRIMARY KEY,
            filingId TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            sourceIp TEXT NOT NULL,
            destination TEXT NOT NULL,
            action TEXT NOT NULL,
            result TEXT NOT NULL,
            FOREIGN KEY (filingId) REFERENCES filing_records(id)
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS manual_corrections (
            id TEXT PRIMARY KEY,
            filingId TEXT NOT NULL,
            field TEXT NOT NULL,
            oldValue TEXT,
            newValue TEXT,
            operator TEXT NOT NULL,
            reason TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (filingId) REFERENCES filing_records(id)
          )
        `);

        resolve();
      });
    });
  }

  createFiling(request: CreateFilingRequest): Promise<FilingRecord> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = dayjs().toISOString();
      const record: FilingRecord = {
        id,
        ...request,
        status: FilingStatus.PENDING,
        approvalStatus: ApprovalStatus.PENDING,
        createdAt: now,
        updatedAt: now
      };

      this.db.run(
        `INSERT INTO filing_records (
          id, serviceName, egressAddress, openWindow, purpose, closeCondition,
          status, approvalStatus, createdAt, updatedAt, creator
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          record.serviceName,
          record.egressAddress,
          JSON.stringify(record.openWindow),
          record.purpose,
          JSON.stringify(record.closeCondition),
          record.status,
          record.approvalStatus,
          record.createdAt,
          record.updatedAt,
          record.creator
        ],
        function(err) {
          if (err) reject(err);
          else resolve(record);
        }
      );
    });
  }

  getFiling(id: string): Promise<FilingRecord | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM filing_records WHERE id = ?',
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else resolve({
            ...row,
            openWindow: JSON.parse(row.openWindow),
            closeCondition: JSON.parse(row.closeCondition)
          });
        }
      );
    });
  }

  listFilings(filters?: { status?: FilingStatus; serviceName?: string }): Promise<FilingRecord[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM filing_records WHERE 1=1';
      const params: any[] = [];

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters?.serviceName) {
        query += ' AND serviceName LIKE ?';
        params.push(`%${filters.serviceName}%`);
      }

      query += ' ORDER BY createdAt DESC';

      this.db.all(query, params, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          openWindow: JSON.parse(row.openWindow),
          closeCondition: JSON.parse(row.closeCondition)
        })));
      });
    });
  }

  updateFilingStatus(
    id: string,
    status: FilingStatus,
    operator?: string,
    reason?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(async () => {
        try {
          const oldFiling = await this.getFiling(id);
          if (!oldFiling) {
            reject(new Error('Filing not found'));
            return;
          }

          const now = dayjs().toISOString();
          
          this.db.run(
            'UPDATE filing_records SET status = ?, updatedAt = ? WHERE id = ?',
            [status, now, id]
          );

          const historyId = uuidv4();
          this.db.run(
            `INSERT INTO status_history (id, filingId, fromStatus, toStatus, timestamp, operator, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [historyId, id, oldFiling.status, status, now, operator || null, reason || '状态更新']
          );

          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  updateApprovalStatus(
    id: string,
    approvalStatus: ApprovalStatus,
    approver: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = dayjs().toISOString();
      this.db.run(
        'UPDATE filing_records SET approvalStatus = ?, approver = ?, approvedAt = ?, updatedAt = ? WHERE id = ?',
        [approvalStatus, approver, now, now, id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  closeFiling(
    id: string,
    closer: string,
    closeReason: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(async () => {
        try {
          const now = dayjs().toISOString();
          
          this.db.run(
            `UPDATE filing_records 
             SET status = ?, closedAt = ?, closer = ?, closeReason = ?, updatedAt = ?
             WHERE id = ?`,
            [FilingStatus.CLOSED, now, closer, closeReason, now, id]
          );

          const oldFiling = await this.getFiling(id);
          const historyId = uuidv4();
          this.db.run(
            `INSERT INTO status_history (id, filingId, fromStatus, toStatus, timestamp, operator, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [historyId, id, oldFiling?.status || null, FilingStatus.CLOSED, now, closer, closeReason]
          );

          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  recordException(
    filingId: string,
    request: HandleExceptionRequest
  ): Promise<ExceptionTrace> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = dayjs().toISOString();
      const trace: ExceptionTrace = {
        id,
        filingId,
        timestamp: now,
        step: request.step,
        originalInput: request.originalInput,
        processingBasis: request.processingBasis,
        conclusion: request.conclusion,
        errorCode: request.errorCode,
        errorMessage: request.errorMessage,
        operator: request.operator
      };

      this.db.run(
        `INSERT INTO exception_traces (
          id, filingId, timestamp, step, originalInput, processingBasis,
          conclusion, errorCode, errorMessage, operator
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          filingId,
          now,
          request.step,
          JSON.stringify(request.originalInput),
          request.processingBasis,
          request.conclusion,
          request.errorCode || null,
          request.errorMessage || null,
          request.operator || null
        ],
        function(err) {
          if (err) reject(err);
          else resolve(trace);
        }
      );
    });
  }

  getExceptions(filingId: string): Promise<ExceptionTrace[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM exception_traces WHERE filingId = ? ORDER BY timestamp DESC',
        [filingId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            ...row,
            originalInput: JSON.parse(row.originalInput)
          })));
        }
      );
    });
  }

  recordAccessLog(
    filingId: string,
    sourceIp: string,
    destination: string,
    action: string,
    result: string
  ): Promise<AccessLog> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = dayjs().toISOString();
      const log: AccessLog = {
        id,
        filingId,
        timestamp: now,
        sourceIp,
        destination,
        action,
        result
      };

      this.db.run(
        `INSERT INTO access_logs (id, filingId, timestamp, sourceIp, destination, action, result)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, filingId, now, sourceIp, destination, action, result],
        function(err) {
          if (err) reject(err);
          else resolve(log);
        }
      );
    });
  }

  getAccessLogs(filingId: string): Promise<AccessLog[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM access_logs WHERE filingId = ? ORDER BY timestamp DESC',
        [filingId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as AccessLog[]);
        }
      );
    });
  }

  getStatusHistory(filingId: string): Promise<StatusHistory[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM status_history WHERE filingId = ? ORDER BY timestamp DESC',
        [filingId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as StatusHistory[]);
        }
      );
    });
  }

  recordManualCorrection(
    filingId: string,
    field: string,
    oldValue: any,
    newValue: any,
    operator: string,
    reason: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = dayjs().toISOString();

      this.db.run(
        `INSERT INTO manual_corrections (id, filingId, field, oldValue, newValue, operator, reason, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, filingId, field, JSON.stringify(oldValue), JSON.stringify(newValue), operator, reason, now],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new Database();
