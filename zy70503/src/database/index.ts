import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  PermissionLease,
  RenewalRecord,
  AuditLog,
  LeaseStatus,
  RenewalStatus
} from '../types';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './lease.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS permission_leases (
          id TEXT PRIMARY KEY,
          accountName TEXT NOT NULL,
          permissionItem TEXT NOT NULL,
          leaseStartTime INTEGER NOT NULL,
          leaseEndTime INTEGER NOT NULL,
          applicationReason TEXT NOT NULL,
          applicant TEXT NOT NULL,
          status TEXT NOT NULL,
          idempotencyKey TEXT UNIQUE NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          recyclingConclusion TEXT,
          blockedReason TEXT
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS renewal_records (
          id TEXT PRIMARY KEY,
          leaseId TEXT NOT NULL,
          previousEndTime INTEGER NOT NULL,
          newEndTime INTEGER NOT NULL,
          renewalReason TEXT NOT NULL,
          approver TEXT,
          status TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          approvedAt INTEGER,
          FOREIGN KEY (leaseId) REFERENCES permission_leases(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          leaseId TEXT NOT NULL,
          operationType TEXT NOT NULL,
          operator TEXT NOT NULL,
          originalInput TEXT,
          processingBasis TEXT NOT NULL,
          finalConclusion TEXT NOT NULL,
          statusBefore TEXT,
          statusAfter TEXT,
          createdAt INTEGER NOT NULL
        )
      `);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_leases_account ON permission_leases(accountName)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_leases_status ON permission_leases(status)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_leases_endtime ON permission_leases(leaseEndTime)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_lease ON audit_logs(leaseId)`);
    });
  }

  async createLease(lease: Omit<PermissionLease, 'id' | 'createdAt' | 'updatedAt'>): Promise<PermissionLease> {
    const now = Date.now();
    const id = uuidv4();
    const newLease: PermissionLease = {
      ...lease,
      id,
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO permission_leases (
          id, accountName, permissionItem, leaseStartTime, leaseEndTime,
          applicationReason, applicant, status, idempotencyKey,
          createdAt, updatedAt, recyclingConclusion, blockedReason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, newLease.accountName, newLease.permissionItem, newLease.leaseStartTime,
          newLease.leaseEndTime, newLease.applicationReason, newLease.applicant,
          newLease.status, newLease.idempotencyKey, newLease.createdAt, newLease.updatedAt,
          newLease.recyclingConclusion || null, newLease.blockedReason || null
        ],
        function(err) {
          if (err) reject(err);
          else resolve(newLease);
        }
      );
    });
  }

  async findLeaseByIdempotencyKey(key: string): Promise<PermissionLease | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM permission_leases WHERE idempotencyKey = ?`,
        [key],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  async findLeaseById(id: string): Promise<PermissionLease | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM permission_leases WHERE id = ?`,
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  async queryLeases(params: {
    accountName?: string;
    status?: LeaseStatus;
    startTime?: number;
    endTime?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: PermissionLease[]; total: number }> {
    const { accountName, status, startTime, endTime, page = 1, pageSize = 20 } = params;
    const conditions: string[] = [];
    const values: any[] = [];

    if (accountName) {
      conditions.push('accountName = ?');
      values.push(accountName);
    }
    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }
    if (startTime) {
      conditions.push('leaseStartTime >= ?');
      values.push(startTime);
    }
    if (endTime) {
      conditions.push('leaseEndTime <= ?');
      values.push(endTime);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT COUNT(*) as count FROM permission_leases ${whereClause}`,
        values,
        (err, countRow: any) => {
          if (err) {
            reject(err);
            return;
          }
          this.db.all(
            `SELECT * FROM permission_leases ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
            [...values, pageSize, offset],
            (err, rows: any[]) => {
              if (err) reject(err);
              else resolve({ data: rows, total: countRow.count });
            }
          );
        }
      );
    });
  }

  async updateLeaseStatus(
    id: string,
    status: LeaseStatus,
    additionalFields?: { recyclingConclusion?: string; blockedReason?: string }
  ): Promise<void> {
    const now = Date.now();
    let sql = 'UPDATE permission_leases SET status = ?, updatedAt = ?';
    const values: any[] = [status, now];

    if (additionalFields?.recyclingConclusion) {
      sql += ', recyclingConclusion = ?';
      values.push(additionalFields.recyclingConclusion);
    }
    if (additionalFields?.blockedReason) {
      sql += ', blockedReason = ?';
      values.push(additionalFields.blockedReason);
    }

    sql += ' WHERE id = ?';
    values.push(id);

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async manualUpdateLease(
    id: string,
    updates: Partial<PermissionLease>
  ): Promise<void> {
    const now = Date.now();
    const setClauses: string[] = ['updatedAt = ?'];
    const values: any[] = [now];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    values.push(id);
    const sql = `UPDATE permission_leases SET ${setClauses.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async createRenewalRecord(
    record: Omit<RenewalRecord, 'id' | 'createdAt'>
  ): Promise<RenewalRecord> {
    const now = Date.now();
    const id = uuidv4();
    const newRecord: RenewalRecord = {
      ...record,
      id,
      createdAt: now
    };

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO renewal_records (
          id, leaseId, previousEndTime, newEndTime, renewalReason,
          approver, status, createdAt, approvedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, newRecord.leaseId, newRecord.previousEndTime, newRecord.newEndTime,
          newRecord.renewalReason, newRecord.approver || null, newRecord.status,
          newRecord.createdAt, newRecord.approvedAt || null
        ],
        function(err) {
          if (err) reject(err);
          else resolve(newRecord);
        }
      );
    });
  }

  async getRenewalRecordsByLeaseId(leaseId: string): Promise<RenewalRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM renewal_records WHERE leaseId = ? ORDER BY createdAt DESC`,
        [leaseId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async findRenewalRecordById(id: string): Promise<RenewalRecord | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM renewal_records WHERE id = ?`,
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  async updateRenewalStatus(
    id: string,
    status: RenewalStatus,
    approver: string
  ): Promise<void> {
    const now = Date.now();
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE renewal_records SET status = ?, approver = ?, approvedAt = ? WHERE id = ?`,
        [status, approver, now, id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async createAuditLog(
    log: Omit<AuditLog, 'id' | 'createdAt'>
  ): Promise<AuditLog> {
    const now = Date.now();
    const id = uuidv4();
    const newLog: AuditLog = {
      ...log,
      id,
      createdAt: now
    };

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO audit_logs (
          id, leaseId, operationType, operator, originalInput,
          processingBasis, finalConclusion, statusBefore, statusAfter, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, newLog.leaseId, newLog.operationType, newLog.operator,
          JSON.stringify(newLog.originalInput), newLog.processingBasis,
          newLog.finalConclusion, newLog.statusBefore || null,
          newLog.statusAfter || null, newLog.createdAt
        ],
        function(err) {
          if (err) reject(err);
          else resolve(newLog);
        }
      );
    });
  }

  async getAuditLogsByLeaseId(leaseId: string): Promise<AuditLog[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM audit_logs WHERE leaseId = ? ORDER BY createdAt DESC`,
        [leaseId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            ...row,
            originalInput: row.originalInput ? JSON.parse(row.originalInput) : null
          })));
        }
      );
    });
  }

  async getExpiredLeases(): Promise<PermissionLease[]> {
    const now = Date.now();
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM permission_leases WHERE status = ? AND leaseEndTime < ?`,
        [LeaseStatus.CONFIRMED, now],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getAllLeasesForExport(params: {
    accountName?: string;
    status?: LeaseStatus;
    startTime?: number;
    endTime?: number;
  }): Promise<PermissionLease[]> {
    const { accountName, status, startTime, endTime } = params;
    const conditions: string[] = [];
    const values: any[] = [];

    if (accountName) {
      conditions.push('accountName = ?');
      values.push(accountName);
    }
    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }
    if (startTime) {
      conditions.push('leaseStartTime >= ?');
      values.push(startTime);
    }
    if (endTime) {
      conditions.push('leaseEndTime <= ?');
      values.push(endTime);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM permission_leases ${whereClause} ORDER BY createdAt DESC`,
        values,
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  close(): void {
    this.db.close();
  }
}

export const db = new Database();
